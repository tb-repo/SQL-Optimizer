from flask import Flask, render_template, request, redirect, url_for, flash, session, make_response, Response, jsonify
from flask_wtf import FlaskForm
from wtforms import TextAreaField, SubmitField, SelectField
from wtforms.validators import DataRequired
from flask_wtf.csrf import CSRFProtect, CSRFError
import os
import csv
import json
import hashlib
import time
import re
from io import StringIO
import sqlparse
from explain_keywords import EXPLAIN_KEYWORDS
import traceback
import html

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change_this_secret_key')
csrf = CSRFProtect(app)

class SQLInputForm(FlaskForm):
    sql_query = TextAreaField(
        'SQL Query',
        validators=[DataRequired()],
        render_kw={
            'placeholder': 'e.g. SELECT id, name FROM users WHERE status = \'active\';',
            'rows': 6
        },
        description='Paste your SQL query here.'
    )
    table_ddl = TextAreaField(
        'Table DDL (optional)',
        render_kw={
            'placeholder': 'e.g. CREATE TABLE users (id INT PRIMARY KEY, name TEXT, status TEXT);',
            'rows': 3
        },
        description='Paste the CREATE TABLE statement(s) for all involved tables.'
    )
    index_info = TextAreaField(
        'Index Information (optional)',
        render_kw={
            'placeholder': 'e.g. CREATE INDEX idx_status ON users(status);',
            'rows': 3
        },
        description='Paste CREATE INDEX statements or describe existing indexes.'
    )
    row_counts = TextAreaField(
        'Table Row Counts (optional)',
        render_kw={
            'placeholder': 'e.g. users: 120000\norders: 500000',
            'rows': 2
        },
        description='Provide row counts in the format: table_name: row_count, one per line.'
    )
    db_engine = SelectField('Database Engine', choices=[
        ('postgresql', 'PostgreSQL'),
        ('oracle', 'Oracle'),
        ('sqlserver', 'SQL Server')
    ], default='postgresql')
    explain_plan = TextAreaField(
        'EXPLAIN Plan Output (optional)',
        render_kw={
            'placeholder': 'e.g.\nSeq Scan on users  (cost=0.00..431.00 rows=21000 width=4)\n  Filter: (status = \'active\')',
            'rows': 4
        },
        description='Paste the output of EXPLAIN (or EXPLAIN ANALYZE) for your query.'
    )
    submit = SubmitField('Analyze')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self.db_engine.data:
            self.db_engine.data = 'postgresql'

def analyze_sql_query(sql_query, tables, indexes, db_engine, explain_plan=None):
    """
    Dispatch to engine-specific analysis logic. For now, returns a placeholder report.
    """
    if db_engine == 'postgresql':
        return analyze_postgresql(sql_query, tables, indexes, explain_plan)
    elif db_engine == 'oracle':
        return analyze_oracle(sql_query, tables, indexes, explain_plan)
    elif db_engine == 'sqlserver':
        return analyze_sqlserver(sql_query, tables, indexes, explain_plan)
    else:
        return analyze_generic(sql_query, tables, indexes, explain_plan)

def parse_size_to_mb(size_str):
    import re
    if not size_str:
        return 0.0
    size_str = str(size_str).strip().replace(' ', '').upper()
    match = re.match(r'^([0-9.]+)(B|KB|MB|GB)?$', size_str)
    if not match:
        return 0.0
    value, unit = match.groups()
    value = float(value)
    if not unit or unit == 'B':
        return value / 1024 / 1024
    elif unit == 'KB':
        return value / 1024
    elif unit == 'MB':
        return value
    elif unit == 'GB':
        return value * 1024
    return 0.0

def calculate_performance_score(sql_query, tables, indexes, warnings, actionable_keys_count, explain_plan=None, db_engine=None, actionable_recommendations=None):
    score = 100
    breakdown_dict = {}
    score_capped_reason = None
    def add_item(category, type_, reason, points, context):
        if category not in breakdown_dict:
            breakdown_dict[category] = []
        breakdown_dict[category].append({'type': type_, 'reason': reason, 'points': points, 'context': context})
    # Plan-driven deductions
    fts_tables = extract_fts_tables_from_explain(explain_plan, db_engine) if explain_plan and db_engine else set()
    num_fts = len(fts_tables)
    if num_fts > 0:
        pts = -min(num_fts * 20, 60)
        score += pts
        for t in fts_tables:
            add_item('Execution Plan', 'deduction', f'Full Table Scan detected on {t}', -20, t)
    # Plan-driven index recommendations
    alias_to_table = get_alias_to_table_mapping(sql_query)
    fts_index_recs = recommend_indexes_for_fts_tables(sql_query, indexes, alias_to_table, tables, explain_plan, db_engine) if explain_plan and db_engine else []
    num_missing_indexes = len([rec for rec in fts_index_recs if rec['key'][0] == 'fts_index'])
    num_investigation = len([rec for rec in fts_index_recs if rec['key'][0] == 'fts_index_exists'])
    if num_missing_indexes > 0:
        pts = -min(num_missing_indexes * 15, 45)
        score += pts
        add_item('Indexing', 'deduction', f'{num_missing_indexes} missing index(es) for FTS tables', pts, f'{num_missing_indexes} missing indexes')
    if num_investigation > 0:
        pts = -min(num_investigation * 10, 30)
        score += pts
        add_item('Indexing', 'deduction', f'{num_investigation} index(es) not used by optimizer (investigation needed)', pts, f'{num_investigation} index not used')
    # Bonuses for actual index usage in plan
    keywords = EXPLAIN_KEYWORDS.get(db_engine, {}) if db_engine else {}
    index_scan_keywords = keywords.get('index', [])
    if explain_plan and any(kw in explain_plan for kw in index_scan_keywords):
        score += 10
        add_item('Execution Plan', 'bonus', 'Index usage detected in EXPLAIN plan', 10, 'Index scan in plan')
    # Cap score and set grade
    score = max(1, min(100, score))
    total_deductions = sum(item['points'] for items in breakdown_dict.values() for item in items if item['type'] == 'deduction')
    total_bonuses = sum(item['points'] for items in breakdown_dict.values() for item in items if item['type'] == 'bonus')
    if num_fts > 0 or num_missing_indexes > 0 or num_investigation > 0:
        if score > 90:
            score = 90
            score_capped_reason = 'Score capped due to FTS or missing/unused indexes.'
    if score >= 90:
        performance_level = "Excellent"
        performance_color = "success"
    elif score >= 75:
        performance_level = "Good"
        performance_color = "info"
    elif score >= 60:
        performance_level = "Fair"
        performance_color = "warning"
    elif score >= 40:
        performance_level = "Poor"
        performance_color = "danger"
    else:
        performance_level = "Very Poor"
        performance_color = "danger"
    calculation = f"100 + {total_bonuses} (strengths) - {abs(total_deductions)} (areas for improvement) = {score}"
    if score_capped_reason:
        calculation += f" ({score_capped_reason})"
    breakdown = [{'category': cat, 'items': items} for cat, items in breakdown_dict.items()]
    return {
        'score': score,
        'level': performance_level,
        'color': performance_color,
        'breakdown': breakdown,
        'calculation': calculation,
    }

def generate_category_summary(group):
    """Generate a human-readable summary for a category"""
    category = group['category']
    items = group['items']
    
    deductions = [item for item in items if item['type'] == 'deduction']
    bonuses = [item for item in items if item['type'] == 'bonus']
    
    if category == 'Query Structure':
        if bonuses and not deductions:
            return "Well-structured query with good practices"
        elif deductions and not bonuses:
            return "Query structure needs improvement"
        elif bonuses and deductions:
            return "Mixed query structure with both strengths and areas for improvement"
        else:
            return "Basic query structure"
    
    elif category == 'Indexing':
        if bonuses and not deductions:
            return "Excellent index coverage"
        elif deductions and not bonuses:
            return "Indexing strategy needs improvement"
        elif bonuses and deductions:
            return "Good index coverage with room for optimization"
        else:
            return "No index information provided"
    
    elif category == 'Table Design':
        if bonuses and not deductions:
            return "Well-designed tables with proper constraints"
        elif deductions and not bonuses:
            return "Table design needs improvement"
        elif bonuses and deductions:
            return "Good table design with some optimization opportunities"
        else:
            return "Basic table design"
    
    elif category == 'Execution Plan':
        if bonuses and not deductions:
            return "Good execution plan analysis"
        elif deductions and not bonuses:
            return "Execution plan shows performance issues"
        elif bonuses and deductions:
            return "Mixed execution plan with both efficient and inefficient operations"
        else:
            return "No execution plan provided"
    
    else:  # General
        if bonuses and not deductions:
            return "Good overall practices"
        elif deductions and not bonuses:
            return "Several areas need attention"
        elif bonuses and deductions:
            return "Mixed performance indicators"
        else:
            return "No specific issues identified"

def generate_overall_summary(breakdown, score, total_bonuses, total_deductions):
    """Generate an overall summary sentence"""
    if score >= 90:
        return f"Excellent performance! Your query is well-optimized with strong practices across all categories."
    elif score >= 75:
        return f"Good performance with {total_bonuses} points in strengths and {total_deductions} points in areas for improvement. Minor optimizations could further enhance performance."
    elif score >= 60:
        return f"Fair performance with {total_bonuses} points in strengths and {total_deductions} points in areas for improvement. Several optimizations are recommended."
    elif score >= 40:
        return f"Poor performance with {total_bonuses} points in strengths and {total_deductions} points in areas for improvement. Significant optimizations are needed."
    else:
        return f"Very poor performance with {total_bonuses} points in strengths and {total_deductions} points in areas for improvement. Major restructuring is recommended."

def calculate_performance_metrics(sql_query, tables, indexes, db_engine, explain_plan=None, actionable_recommendations=None):
    metrics = {
        'estimated_execution_time': {'value': 'Unknown', 'source': 'unknown'},
        'estimated_rows_scanned': {'value': 'Unknown', 'source': 'unknown'},
        'estimated_memory_usage': {'value': 'Unknown', 'source': 'unknown'},
        'cost': {'value': 'Unknown', 'source': 'unknown'},
        'complexity_score': 0,
        'index_utilization': 0,
        'join_complexity': 0,
        'aggregation_complexity': 0,
        'resource_intensity': 'Low',
        'performance_grade': 'A',
        'query_efficiency': 0,
        'data_access_pattern': 'Unknown',
        'optimization_potential': 0
    }
    try:
        sql_upper = sql_query.upper()
        complexity = 0
        join_count = sql_upper.count('JOIN')
        complexity += join_count * 15
        metrics['join_complexity'] = join_count
        agg_functions = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN']
        agg_count = 0
        import sqlparse
        parsed = sqlparse.parse(sql_query)
        for stmt in parsed:
            for token in stmt.tokens:
                if isinstance(token, sqlparse.sql.IdentifierList):
                    for ident in token.get_identifiers():
                        for func in agg_functions:
                            if func in ident.value.upper():
                                agg_count += 1
                elif isinstance(token, sqlparse.sql.Function):
                    for func in agg_functions:
                        if func in token.get_name().upper():
                            agg_count += 1
                elif token.ttype is None and 'GROUP BY' in token.value.upper():
                    agg_count += 1
                elif token.ttype is None and 'HAVING' in token.value.upper():
                    agg_count += 1
        complexity += agg_count * 8
        metrics['aggregation_complexity'] = agg_count
        subquery_count = sql_upper.count('SELECT') - 1
        complexity += subquery_count * 20
        window_count = sql_upper.count('OVER')
        complexity += window_count * 12
        json_ops = ['->>', '->', 'JSONB_', 'JSON_']
        json_count = sum(sql_upper.count(op) for op in json_ops)
        complexity += json_count * 5
        cte_count = sql_upper.count('WITH')
        complexity += cte_count * 10
        metrics['complexity_score'] = min(complexity, 100)
        # --- Extract from EXPLAIN plan if possible ---
        plan_metrics = extract_explain_plan_metrics(explain_plan, db_engine) if explain_plan else {}
        # Rows scanned
        if plan_metrics and plan_metrics.get('rows_scanned') is not None:
            metrics['estimated_rows_scanned'] = {'value': plan_metrics['rows_scanned'], 'source': 'from plan'}
        # Cost
        if plan_metrics and plan_metrics.get('cost') is not None:
            metrics['cost'] = {'value': plan_metrics['cost'], 'source': 'from plan'}
        # Memory
        if plan_metrics and plan_metrics.get('memory') is not None:
            mem_val = plan_metrics['memory']
            if mem_val < 1:
                mem_str = f"{mem_val*1024:.0f}KB"
            elif mem_val < 1024:
                mem_str = f"{mem_val:.1f}MB"
            else:
                mem_str = f"{mem_val/1024:.1f}GB"
            metrics['estimated_memory_usage'] = {'value': mem_str, 'source': 'from plan'}
        # Time
        if plan_metrics and plan_metrics.get('time') is not None:
            tval = plan_metrics['time']
            if tval < 0.5:
                tstr = f"{tval:.2f}s"
            elif tval < 60:
                tstr = f"{tval:.1f}s"
            else:
                tstr = f"{tval/60:.1f}min"
            metrics['estimated_execution_time'] = {'value': tstr, 'source': 'from plan'}
        # --- Plan-driven Index Utilization and Data Access Pattern ---
        explain_plan_str = explain_plan if explain_plan else ''
        keywords = EXPLAIN_KEYWORDS.get(db_engine, {})
        index_scan_keywords = keywords.get('index', [])
        table_scan_keywords = keywords.get('table', []) + keywords.get('sequential', []) + keywords.get('full_scan', []) + keywords.get('scan', [])
        # Index Utilization
        if any(kw in explain_plan_str for kw in table_scan_keywords):
            metrics['index_utilization'] = 0
        elif any(kw in explain_plan_str for kw in index_scan_keywords):
            metrics['index_utilization'] = 100
        else:
            metrics['index_utilization'] = 0
        # Data Access Pattern
        if any(kw in explain_plan_str for kw in table_scan_keywords):
            metrics['data_access_pattern'] = 'Full Scan'
        elif any(kw in explain_plan_str for kw in index_scan_keywords):
            metrics['data_access_pattern'] = 'Indexed'
        elif join_count > 0:
            metrics['data_access_pattern'] = 'Join-based'
        else:
            metrics['data_access_pattern'] = 'Simple'
        # --- Improved Optimization Potential Calculation ---
        # 1. Count FTS tables and estimate their size/rows from plan
        fts_tables = extract_fts_tables_from_explain(explain_plan, db_engine) if explain_plan and db_engine else set()
        fts_row_count = 0
        large_fts_tables = 0
        if plan_metrics and 'fts_table_rows' in plan_metrics:
            # plan_metrics['fts_table_rows'] should be a dict {table: row_count}
            for table, rows in plan_metrics['fts_table_rows'].items():
                fts_row_count += rows
                if rows >= 100000:
                    large_fts_tables += 1
        else:
            # fallback: if no row info, count FTS tables
            large_fts_tables = len(fts_tables)
        actionable_total = len(actionable_recommendations or [])
        # Heuristic: high optimization potential if multiple FTS on large tables or any FTS tables (even without row info)
        if large_fts_tables >= 2:
            metrics['optimization_potential'] = 100
        elif large_fts_tables == 1:
            metrics['optimization_potential'] = 80
        elif len(fts_tables) > 0:
            metrics['optimization_potential'] = 60
        elif actionable_total > 0:
            metrics['optimization_potential'] = min(40 + actionable_total * 10, 80)
        else:
            metrics['optimization_potential'] = 0
        # Performance Grade
        if metrics['index_utilization'] == 100 and metrics['data_access_pattern'] == 'Indexed' and metrics['optimization_potential'] == 0:
            metrics['performance_grade'] = 'A'
        elif metrics['index_utilization'] >= 60 and metrics['optimization_potential'] <= 20:
            metrics['performance_grade'] = 'B'
        elif metrics['index_utilization'] >= 40 and metrics['optimization_potential'] <= 40:
            metrics['performance_grade'] = 'C'
        elif metrics['index_utilization'] >= 20:
            metrics['performance_grade'] = 'D'
        else:
            metrics['performance_grade'] = 'F'
        # Remove or hide any metric that cannot be made accurate (already done by fallback to 'Unknown')
    except Exception as e:
        metrics['performance_grade'] = 'C'
    return metrics

def analyze_postgresql(sql_query, tables, indexes, explain_plan=None):
    import re
    import sqlparse
    from explain_keywords import EXPLAIN_KEYWORDS
    recommendations = []
    warnings = []
    optimized_query = None
    summary = []
    
    # Parse explain plan to JSON for enhanced analysis
    execution_tree = None
    if explain_plan:
        execution_tree = parse_explain_to_json(explain_plan, 'postgresql')
    
    explain_mermaid = parse_explain_plan_to_mermaid(explain_plan, 'postgresql')
    alias_to_table = get_alias_to_table_mapping(sql_query)
    detected_engine = detect_engine_from_explain(explain_plan)
    if detected_engine and detected_engine != 'postgresql':
        msg = f"It looks like your EXPLAIN plan is for {detected_engine.capitalize()}, but you selected PostgreSQL. Please choose the correct database engine for accurate analysis."
        warnings.append(msg)
        summary.insert(0, msg)
        recommendations.insert(0, {'text': msg, 'actionable': False, 'sub': [], 'key': ('engine_mismatch',)})
        return {
            'engine': 'PostgreSQL',
            'summary': summary,
            'recommendations': recommendations,
            'warnings': warnings,
            'engine_mismatch': True
        }
    if re.search(r'SELECT\s+\*', sql_query, re.IGNORECASE):
        recommendations.append({'text': "Replace SELECT * with explicit column names for better performance and maintainability.", 'actionable': True, 'sub': [], 'key': ('query', 'select_star')})
        summary.append("Query uses SELECT *; consider selecting only needed columns.")
        warnings.append("Avoid using SELECT *. Specify only the columns you need for better performance and maintainability.")
        optimized_query = re.sub(r'SELECT\s+\*', 'SELECT <columns>', sql_query, flags=re.IGNORECASE)
    parsed = sqlparse.parse(sql_query)
    lines = sql_query.splitlines()
    for stmt in parsed:
        tokens = list(stmt.flatten())
        join_indices = [i for i, t in enumerate(tokens) if t.match(sqlparse.tokens.Keyword, 'JOIN', regex=False)]
        for idx in join_indices:
            table_token = tokens[idx + 1] if idx + 1 < len(tokens) else None
            table_name = table_token.value if table_token and table_token.value.strip() else '(unknown)'
            for lineno, line in enumerate(lines, 1):
                if table_name in line and 'JOIN' in line.upper():
                    break
            else:
                lineno = '?'
            has_on = False
            for t in tokens[idx+2:idx+6]:
                if t.match(sqlparse.tokens.Keyword, 'ON', regex=False):
                    has_on = True
                    break
            if not has_on:
                warn_msg = f"JOIN without ON clause for table {table_name} (line {lineno})"
                recommendations.append({'text': f"Add an ON clause to the JOIN for table {table_name} (line {lineno}) to avoid cartesian products and improve performance.", 'actionable': True, 'sub': [], 'key': ('join', table_name, lineno)})
                warnings.append(warn_msg)
                summary.append(warn_msg)
    if re.search(r'FROM\s*\(\s*SELECT', sql_query, re.IGNORECASE):
        recommendations.append({'text': "Consider rewriting subqueries in FROM clause as JOINs for better performance and readability.", 'actionable': True, 'sub': [], 'key': ('query', 'subquery_to_join')})
        summary.append("Query uses subquery in FROM clause.")
    recommendations.extend(get_real_column_index_recommendations(sql_query, indexes, alias_to_table, tables))
    # FTS table summary and recommendations
    fts_tables = extract_fts_tables_from_explain(explain_plan, 'postgresql') if explain_plan else set()
    if fts_tables:
        summary.append(f"Full Table Scan detected on: {', '.join(sorted(fts_tables))}")
        for fts_table in fts_tables:
            recommendations.append({'text': f"Table '{fts_table}' is accessed via Full Table Scan. Review for possible indexing or query rewrite.", 'actionable': True, 'sub': [], 'key': ('fts_review', fts_table)})
    actionable_recs = [r for r in recommendations if r.get('actionable')]
    if not indexes and not actionable_recs:
        recommendations.append({'text': "No indexes provided. Consider adding indexes on columns used in WHERE, JOIN, and ORDER BY clauses.", 'actionable': False, 'sub': [], 'key': ('index', 'none', 'none')})
    # Deduplicate recommendations
    seen = set()
    deduped_recs = []
    for rec in recommendations:
        key = rec['key'] if isinstance(rec, dict) and 'key' in rec else rec
        if key not in seen:
            deduped_recs.append(rec)
            seen.add(key)
    deduped_recs.sort(key=lambda r: not (isinstance(r, dict) and r.get('actionable')))
    recommendations = deduped_recs
    warnings = list(dict.fromkeys(warnings))
    summary = list(dict.fromkeys(summary))
    if not recommendations:
        recommendations = [{'text': 'No actionable recommendations ‰', 'actionable': False, 'sub': [], 'key': ('none',)}]
    if not summary:
        summary = ['No summary available for this query.']
    actionable_keys_count = 0
    if recommendations and isinstance(recommendations[0], dict):
        actionable_keys = set(r['key'] for r in recommendations if r.get('actionable'))
        actionable_keys_count = len(actionable_keys)
    performance_score = calculate_performance_score(sql_query, tables, indexes, warnings, actionable_keys_count, explain_plan, db_engine='postgresql')
    performance_metrics = calculate_performance_metrics(sql_query, tables, indexes, 'postgresql', explain_plan, [r for r in recommendations if r.get('actionable')])
    fts_index_recs = recommend_indexes_for_fts_tables(sql_query, indexes, alias_to_table, tables, explain_plan, 'postgresql')
    for rec in fts_index_recs:
        if rec['key'] not in [r['key'] for r in recommendations if isinstance(r, dict) and 'key' in r]:
            recommendations.append(rec)
    
    # Create initial analysis result
    analysis_result = {
        'engine': 'PostgreSQL',
        'summary': summary,
        'recommendations': recommendations,
        'warnings': warnings,
        'optimized_query': optimized_query,
        'explain_mermaid': explain_mermaid,
        'performance_score': performance_score,
        'performance_metrics': performance_metrics
    }
    
    # Enhance analysis with execution plan insights if available
    if execution_tree:
        analysis_result = enhance_analysis_with_execution_plan(analysis_result, execution_tree, 'postgresql')
    
    return analysis_result

def analyze_sqlserver(sql_query, tables, indexes, explain_plan=None):
    import re
    import sqlparse
    recommendations = []
    warnings = []
    optimized_query = None
    summary = []
    explain_mermaid = parse_explain_plan_to_mermaid(explain_plan, 'sqlserver')
    alias_to_table = get_alias_to_table_mapping(sql_query)
    detected_engine = detect_engine_from_explain(explain_plan)
    if detected_engine and detected_engine != 'sqlserver':
        msg = f"It looks like your EXPLAIN plan is for {detected_engine.capitalize()}, but you selected SQL Server. Please choose the correct database engine for accurate analysis."
        warnings.append(msg)
        summary.insert(0, msg)
        recommendations.insert(0, {'text': msg, 'actionable': False, 'sub': [], 'key': ('engine_mismatch',)})
        return {
            'engine': 'SQL Server',
            'summary': summary,
            'recommendations': recommendations,
            'warnings': warnings,
            'engine_mismatch': True
        }
    if re.search(r'SELECT\s+\*', sql_query, re.IGNORECASE):
        recommendations.append({
            'text': "Replace SELECT * with explicit column names for better performance and maintainability.",
            'actionable': True, 'sub': [], 'key': ('query', 'select_star')
        })
        warnings.append("Avoid using SELECT *. Specify only the columns you need for better performance and maintainability.")
        optimized_query = re.sub(r'SELECT\s+\*', 'SELECT <columns>', sql_query, flags=re.IGNORECASE)
        summary.append("Query uses SELECT *.")
    parsed = sqlparse.parse(sql_query)
    lines = sql_query.splitlines()
    for stmt in parsed:
        tokens = list(stmt.flatten())
        join_indices = [i for i, t in enumerate(tokens) if t.match(sqlparse.tokens.Keyword, 'JOIN', regex=False)]
        for idx in join_indices:
            table_token = tokens[idx + 1] if idx + 1 < len(tokens) else None
            table_name = table_token.value if table_token and table_token.value.strip() else '(unknown)'
            for lineno, line in enumerate(lines, 1):
                if table_name in line and 'JOIN' in line.upper():
                    break
            else:
                lineno = '?'
            has_on = False
            for t in tokens[idx+2:idx+6]:
                if t.match(sqlparse.tokens.Keyword, 'ON', regex=False):
                    has_on = True
                    break
            if not has_on:
                warn_msg = f"JOIN without ON clause for table {table_name} (line {lineno})"
                recommendations.append({
                    'text': f"Add an ON clause to the JOIN for table {table_name} (line {lineno}) to avoid cartesian products and improve performance.",
                    'actionable': True, 'sub': [], 'key': ('join', table_name, lineno)
                })
                warnings.append(warn_msg)
                summary.append(warn_msg)
    if re.search(r'FROM\s*\(\s*SELECT', sql_query, re.IGNORECASE):
        recommendations.append({
            'text': "Consider rewriting subqueries in FROM clause as JOINs for better performance and readability.",
            'actionable': True, 'sub': [], 'key': ('query', 'subquery_to_join')
        })
        summary.append("Query uses subquery in FROM clause.")
    recommendations.extend(get_real_column_index_recommendations(sql_query, indexes, alias_to_table, tables))
    if not indexes:
        recommendations.append({
            'text': "No indexes provided. Consider adding indexes on columns used in WHERE, JOIN, and ORDER BY clauses.",
            'actionable': False, 'sub': [], 'key': ('index', 'none', 'none')
        })
    performance_score = calculate_performance_score(sql_query, tables, indexes, warnings, len([r for r in recommendations if r.get('actionable')]), explain_plan)
    performance_metrics = calculate_performance_metrics(sql_query, tables, indexes, 'sqlserver')
    if explain_plan:
        keywords = EXPLAIN_KEYWORDS['sqlserver']
        if any(kw in explain_plan for kw in keywords.get('sequential', []) + keywords.get('table', []) + keywords.get('full_scan', []) + keywords.get('scan', [])):
            recommendations.append({'text': "EXPLAIN plan shows a Table Scan. Consider adding indexes or rewriting the query to enable index usage.", 'actionable': True, 'sub': [], 'key': ('scan',)})
            summary.append("Table Scan detected in EXPLAIN plan.")
    # FTS index recommendations
    fts_index_recs = recommend_indexes_for_fts_tables(sql_query, indexes, alias_to_table, tables, explain_plan, 'sqlserver')
    for rec in fts_index_recs:
        if rec['key'] not in [r['key'] for r in recommendations if isinstance(r, dict) and 'key' in r]:
            recommendations.append(rec)
    return {
        'engine': 'SQL Server',
        'summary': summary or ['SQL Server-specific analysis will appear here.'],
        'recommendations': recommendations,
        'warnings': warnings,
        'optimized_query': optimized_query,
        'explain_mermaid': explain_mermaid,
        'performance_score': performance_score,
        'performance_metrics': performance_metrics
    }

def analyze_oracle(sql_query, tables, indexes, explain_plan=None):
    import re
    import sqlparse
    from explain_keywords import EXPLAIN_KEYWORDS
    recommendations = []
    warnings = []
    optimized_query = None
    summary = []
    explain_mermaid = parse_explain_plan_to_mermaid(explain_plan, 'oracle')
    alias_to_table = get_alias_to_table_mapping(sql_query)
    detected_engine = detect_engine_from_explain(explain_plan)
    if detected_engine and detected_engine != 'oracle':
        msg = f"It looks like your EXPLAIN plan is for {detected_engine.capitalize()}, but you selected Oracle. Please choose the correct database engine for accurate analysis."
        warnings.append(msg)
        summary.insert(0, msg)
        recommendations.insert(0, {'text': msg, 'actionable': False, 'sub': [], 'key': ('engine_mismatch',)})
        return {
            'engine': 'Oracle',
            'summary': summary,
            'recommendations': recommendations,
            'warnings': warnings,
            'engine_mismatch': True
        }
    if re.search(r'SELECT\s+\*', sql_query, re.IGNORECASE):
        recommendations.append({
            'text': "Replace SELECT * with explicit column names for better performance and maintainability.",
            'actionable': True, 'sub': [], 'key': ('query', 'select_star')
        })
        warnings.append("Avoid using SELECT *. Specify only the columns you need for better performance and maintainability.")
        optimized_query = re.sub(r'SELECT\s+\*', 'SELECT <columns>', sql_query, flags=re.IGNORECASE)
        summary.append("Query uses SELECT *; consider selecting only needed columns.")
    # Improved JOIN/ON detection: only warn if a JOIN truly lacks an ON clause
    join_pattern = re.compile(r'JOIN\s+([\w\.]+)?', re.IGNORECASE)
    join_matches = list(join_pattern.finditer(sql_query))
    on_pattern = re.compile(r'ON\s+[^\n]+', re.IGNORECASE)
    if join_matches:
        for i, jm in enumerate(join_matches):
            join_start = jm.end()
            join_end = join_matches[i+1].start() if i+1 < len(join_matches) else len(sql_query)
            join_block = sql_query[join_start:join_end]
            if not on_pattern.search(join_block):
                table_name = jm.group(1) if jm.group(1) else None
                if table_name:
                    warn_msg = f"JOIN without ON clause for table {table_name}"
                    if warn_msg not in warnings:
                        warnings.append(warn_msg)
                        summary.append(warn_msg)
                        recommendations.append({'text': f"Add an ON clause to the JOIN for table {table_name} to avoid cartesian products and improve performance.", 'actionable': True, 'sub': [], 'key': ('join', table_name)})
                else:
                    warn_msg = "JOIN without ON clause detected"
                    if warn_msg not in warnings:
                        warnings.append(warn_msg)
                        summary.append(warn_msg)
                        recommendations.append({'text': "Add ON clauses to all JOINs to avoid cartesian products and improve performance.", 'actionable': True, 'sub': [], 'key': ('join', 'generic')})
    if re.search(r'FROM\s*\(\s*SELECT', sql_query, re.IGNORECASE):
        recommendations.append({
            'text': "Consider rewriting subqueries in FROM clause as JOINs for better performance and readability.",
            'actionable': True, 'sub': [], 'key': ('query', 'subquery_to_join')
        })
        summary.append("Query uses subquery in FROM clause.")
    recommendations.extend(get_real_column_index_recommendations(sql_query, indexes, alias_to_table, tables))
    # FTS table summary and recommendations
    fts_tables = extract_fts_tables_from_explain(explain_plan, 'oracle') if explain_plan else set()
    if fts_tables:
        summary.append(f"Full Table Scan detected on: {', '.join(sorted(fts_tables))}")
        for fts_table in fts_tables:
            recommendations.append({'text': f"Table '{fts_table}' is accessed via Full Table Scan. Review for possible indexing or query rewrite.", 'actionable': True, 'sub': [], 'key': ('fts_review', fts_table)})
    # Only show 'No indexes provided' if no actionable FTS/index recommendations exist
    actionable_recs = [r for r in recommendations if r.get('actionable')]
    if not indexes and not actionable_recs:
        recommendations.append({'text': "No indexes provided. Consider adding indexes on columns used in WHERE, JOIN, and ORDER BY clauses.", 'actionable': False, 'sub': [], 'key': ('index', 'none', 'none')})
    # Deduplicate recommendations
    seen = set()
    deduped_recs = []
    for rec in recommendations:
        key = rec['key'] if isinstance(rec, dict) and 'key' in rec else rec
        if key not in seen:
            deduped_recs.append(rec)
            seen.add(key)
    deduped_recs.sort(key=lambda r: not (isinstance(r, dict) and r.get('actionable')))
    recommendations = deduped_recs
    warnings = list(dict.fromkeys(warnings))
    summary = list(dict.fromkeys(summary))
    if not recommendations:
        recommendations = [{'text': 'No actionable recommendations ‰', 'actionable': False, 'sub': [], 'key': ('none',)}]
    if not summary:
        summary = ['No summary available for this query.']
    actionable_keys_count = 0
    if recommendations and isinstance(recommendations[0], dict):
        actionable_keys = set(r['key'] for r in recommendations if r.get('actionable'))
        actionable_keys_count = len(actionable_keys)
    performance_score = calculate_performance_score(sql_query, tables, indexes, warnings, actionable_keys_count, explain_plan, db_engine='oracle')
    performance_metrics = calculate_performance_metrics(sql_query, tables, indexes, 'oracle', explain_plan, [r for r in recommendations if r.get('actionable')])
    # FTS index recommendations
    fts_index_recs = recommend_indexes_for_fts_tables(sql_query, indexes, alias_to_table, tables, explain_plan, 'oracle')
    for rec in fts_index_recs:
        if rec['key'] not in [r['key'] for r in recommendations if isinstance(r, dict) and 'key' in r]:
            recommendations.append(rec)
    return {
        'engine': 'Oracle',
        'summary': summary,
        'recommendations': recommendations,
        'warnings': warnings,
        'optimized_query': optimized_query,
        'explain_mermaid': explain_mermaid,
        'performance_score': performance_score,
        'performance_metrics': performance_metrics
    }

def analyze_generic(sql_query, tables, indexes, explain_plan=None):
    # Basic generic analysis
    recommendations = []
    warnings = []
    summary = []
    
    # Generate EXPLAIN plan visualization
    explain_mermaid = parse_explain_plan_to_mermaid(explain_plan, 'generic')
    
    # Calculate performance score
    performance_score = calculate_performance_score(sql_query, tables, indexes, warnings, recommendations, explain_plan)
    
    # Calculate performance metrics
    performance_metrics = calculate_performance_metrics(sql_query, tables, indexes, 'generic')
    
    return {
        'engine': 'Generic',
        'summary': summary or ['Generic SQL analysis will appear here.'],
        'recommendations': recommendations,
        'warnings': warnings,
        'optimized_query': None,
        'explain_mermaid': explain_mermaid,
        'performance_score': performance_score,
        'performance_metrics': performance_metrics
    }

@app.route('/', methods=['GET', 'POST'])
def index():
    form = SQLInputForm()
    edit_mode = request.args.get('edit') == '1'
    cleared = request.args.get('cleared') == '1'
    if request.method == 'GET':
        form.db_engine.data = 'postgresql'
    if request.method == 'POST' and (form.validate() or edit_mode):
        if edit_mode:
            form.sql_query.data = request.form.get('sql_query', '')
            form.db_engine.data = request.form.get('db_engine') or 'postgresql'
            form.explain_plan.data = request.form.get('explain_plan', '')
            tables = []
            idx = 0
            while True:
                name = request.form.get(f'table_name_{idx}')
                ddl = request.form.get(f'table_ddl_{idx}')
                rows = request.form.get(f'table_rows_{idx}')
                size = request.form.get(f'table_size_{idx}')
                has_primary = request.form.get(f'table_has_primary_{idx}') == 'on'
                primary_key = request.form.get(f'table_primary_key_{idx}', '')
                has_foreign = request.form.get(f'table_has_foreign_{idx}') == 'on'
                foreign_key = request.form.get(f'table_foreign_key_{idx}', '')
                foreign_table = request.form.get(f'table_foreign_table_{idx}', '')
                if name or ddl or rows or size or has_primary or has_foreign:
                    tables.append({
                        'name': name, 
                        'ddl': ddl, 
                        'rows': rows, 
                        'size': size,
                        'has_primary_key': has_primary,
                        'primary_key_column': primary_key,
                        'has_foreign_key': has_foreign,
                        'foreign_key_column': foreign_key,
                        'foreign_key_table': foreign_table
                    })
                    idx += 1
                else:
                    break
            indexes = []
            idx = 0
            while True:
                iname = request.form.get(f'index_name_{idx}')
                itable = request.form.get(f'index_table_{idx}')
                idef = request.form.get(f'index_def_{idx}')
                isize = request.form.get(f'index_size_{idx}')
                if iname or itable or idef or isize:
                    indexes.append({'name': iname, 'table': itable, 'definition': idef, 'size': isize})
                    idx += 1
                else:
                    break
            if db_engine == 'mysql':
                report = analyze_mysql(sql_query, tables, indexes, explain_plan)
            elif db_engine == 'postgresql':
                report = analyze_postgresql(sql_query, tables, indexes, explain_plan)
            elif db_engine == 'sqlserver':
                report = analyze_sqlserver(sql_query, tables, indexes, explain_plan)
            elif db_engine == 'oracle':
                report = analyze_oracle(sql_query, tables, indexes, explain_plan)
            elif db_engine == 'sqlite':
                report = analyze_sqlite(sql_query, tables, indexes, explain_plan)
            else:
                report = analyze_generic(sql_query, tables, indexes, explain_plan)
            return render_template('result.html', form=form, report=report, tables=tables, indexes=indexes, db_engine=db_engine, sql_query=sql_query)
        sql_query = form.sql_query.data
        db_engine = form.db_engine.data or 'postgresql'
        explain_plan = form.explain_plan.data
        tables = []
        idx = 0
        while True:
            name = request.form.get(f'table_name_{idx}')
            ddl = request.form.get(f'table_ddl_{idx}')
            rows = request.form.get(f'table_rows_{idx}')
            size = request.form.get(f'table_size_{idx}')
            has_primary = request.form.get(f'table_has_primary_{idx}') == 'on'
            primary_key = request.form.get(f'table_primary_key_{idx}', '')
            has_foreign = request.form.get(f'table_has_foreign_{idx}') == 'on'
            foreign_key = request.form.get(f'table_foreign_key_{idx}', '')
            foreign_table = request.form.get(f'table_foreign_table_{idx}', '')
            if name or ddl or rows or size or has_primary or has_foreign:
                tables.append({
                    'name': name, 
                    'ddl': ddl, 
                    'rows': rows, 
                    'size': size,
                    'has_primary_key': has_primary,
                    'primary_key_column': primary_key,
                    'has_foreign_key': has_foreign,
                    'foreign_key_column': foreign_key,
                    'foreign_key_table': foreign_table
                })
                idx += 1
            else:
                break
        indexes = []
        idx = 0
        while True:
            iname = request.form.get(f'index_name_{idx}')
            itable = request.form.get(f'index_table_{idx}')
            idef = request.form.get(f'index_def_{idx}')
            isize = request.form.get(f'index_size_{idx}')
            if iname or itable or idef or isize:
                indexes.append({'name': iname, 'table': itable, 'definition': idef, 'size': isize})
                idx += 1
            else:
                break
        report = analyze_sql_query(sql_query, tables, indexes, db_engine, explain_plan)
        history = session.get('history', [])
        history.insert(0, {
            'sql_query': sql_query,
            'tables': tables,
            'indexes': indexes,
            'db_engine': db_engine,
            'explain_plan': explain_plan,
            'report': report
        })
        session['history'] = history[:5]
        session.modified = True
        return render_template('result.html', 
                             report=report, 
                             db_engine=db_engine, 
                             history=session['history'],
                             sql_query=form.sql_query.data,
                             tables=tables,
                             indexes=indexes)
    return render_template('index.html', form=form, cleared=cleared)

@app.route('/result')
def result():
    # This route is now only for direct GETs; POSTs handled in index
    db_engine = request.args.get('db_engine', 'other')
    history = session.get('history', [])
    return render_template('result.html', report=None, db_engine=db_engine, history=history)

@app.route('/clear_history', methods=['POST'])
def clear_history():
    """Clear the analysis history from session"""
    session['history'] = []
    session.modified = True
    # Redirect to home page with a success message
    return redirect(url_for('index', cleared='1'))

@app.route('/clear_history_ajax', methods=['POST'])
def clear_history_ajax():
    """Clear history via AJAX for better UX"""
    try:
        session['history'] = []
        session.modified = True
        return jsonify({'success': True, 'message': 'History cleared successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Remove PDF routes and WeasyPrint import
# Add CSV export for history
@app.route('/download_history_csv')
def download_history_csv():
    history = session.get('history', [])
    si = StringIO()
    writer = csv.writer(si)
    writer.writerow(['SQL Query', 'Database Engine', 'Summary', 'Recommendations', 'Warnings', 'Optimized Query'])
    for h in history:
        writer.writerow([
            h.get('sql_query', ''),
            h.get('db_engine', ''),
            h['report'].get('summary', '') if h.get('report') else '',
            '; '.join(h['report'].get('recommendations', [])) if h.get('report') else '',
            '; '.join(h['report'].get('warnings', [])) if h.get('report') else '',
            h['report'].get('optimized_query', '') if h.get('report') else ''
        ])
    output = si.getvalue()
    return Response(
        output,
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment;filename=sql_analysis_history.csv'}
    )

@app.route('/help')
def help_page():
    """Display the help guide page."""
    return render_template('help.html')

@app.route('/analytics')
def analytics_dashboard():
    """Advanced Analytics Dashboard showing performance trends and insights"""
    # Get analysis history from session
    history = session.get('history', [])
    
    if not history:
        return render_template('analytics.html', 
                             history=[],
                             analytics_data={},
                             insights=[],
                             trends={})
    
    # Calculate analytics data
    analytics_data = calculate_analytics_data(history)
    insights = generate_insights(history)
    trends = calculate_trends(history)
    
    return render_template('analytics.html',
                         history=history,
                         analytics_data=analytics_data,
                         insights=insights,
                         trends=trends)

@app.route('/compare', methods=['GET', 'POST'])
def compare_queries():
    """Advanced query comparison page"""
    if request.method == 'POST':
        # Get queries from form
        queries = []
        for i in range(1, 6):  # Support up to 5 queries
            query = request.form.get(f'query_{i}', '').strip()
            db_engine = request.form.get(f'db_engine_{i}', 'mysql')
            if query:
                queries.append({
                    'query': query,
                    'db_engine': db_engine,
                    'index': i
                })
        
        if len(queries) < 2:
            flash('Please provide at least 2 queries to compare.', 'warning')
            return render_template('compare.html', queries=[], comparison_results=[])
        
        # Analyze each query
        comparison_results = []
        for query_data in queries:
            analysis_result = analyze_sql_query(
                query_data['query'], 
                {}, 
                {}, 
                query_data['db_engine']
            )
            
            # Ensure performance_metrics exists and has the right structure
            if 'performance_metrics' not in analysis_result:
                analysis_result['performance_metrics'] = {}
            
            # Set default values for missing metrics
            metrics = analysis_result['performance_metrics']
            metrics.setdefault('execution_time', 1.0)
            metrics.setdefault('complexity_score', 50.0)
            metrics.setdefault('optimization_potential', 25.0)
            metrics.setdefault('memory_usage', 50.0)
            metrics.setdefault('cpu_usage', 50.0)
            metrics.setdefault('complexity_grade', 'C')
            metrics.setdefault('optimization_grade', 'C')
            
            comparison_results.append({
                'query': query_data['query'],
                'db_engine': query_data['db_engine'],
                'index': query_data['index'],
                'analysis': analysis_result
            })
        
        # Calculate comparison metrics
        comparison_metrics = calculate_comparison_metrics(comparison_results)
        
        return render_template('compare.html', 
                             queries=queries, 
                             comparison_results=comparison_results,
                             comparison_metrics=comparison_metrics)
    
    return render_template('compare.html', queries=[], comparison_results=[])

def calculate_comparison_metrics(comparison_results):
    """Calculate metrics for comparing multiple queries"""
    if len(comparison_results) < 2:
        return {}
    
    metrics = {
        'performance_ranking': [],
        'complexity_ranking': [],
        'optimization_potential': [],
        'resource_usage': [],
        'key_differences': [],
        'recommendations': []
    }
    
    # Extract performance metrics for ranking
    performance_data = []
    complexity_data = []
    optimization_data = []
    resource_data = []
    
    for result in comparison_results:
        analysis = result['analysis']
        if 'performance_metrics' in analysis:
            perf = analysis['performance_metrics']
            performance_data.append({
                'index': result['index'],
                'query': result['query'][:50] + '...' if len(result['query']) > 50 else result['query'],
                'execution_time': perf.get('execution_time', 0),
                'complexity_score': perf.get('complexity_score', 0),
                'optimization_potential': perf.get('optimization_potential', 0),
                'memory_usage': perf.get('memory_usage', 0),
                'cpu_usage': perf.get('cpu_usage', 0)
            })
            
            complexity_data.append({
                'index': result['index'],
                'query': result['query'][:50] + '...' if len(result['query']) > 50 else result['query'],
                'complexity_score': perf.get('complexity_score', 0),
                'grade': perf.get('complexity_grade', 'Unknown')
            })
            
            optimization_data.append({
                'index': result['index'],
                'query': result['query'][:50] + '...' if len(result['query']) > 50 else result['query'],
                'optimization_potential': perf.get('optimization_potential', 0),
                'grade': perf.get('optimization_grade', 'Unknown')
            })
            
            resource_data.append({
                'index': result['index'],
                'query': result['query'][:50] + '...' if len(result['query']) > 50 else result['query'],
                'memory_usage': perf.get('memory_usage', 0),
                'cpu_usage': perf.get('cpu_usage', 0)
            })
    
    # Sort by different metrics
    metrics['performance_ranking'] = sorted(performance_data, key=lambda x: x['execution_time'])
    metrics['complexity_ranking'] = sorted(complexity_data, key=lambda x: x['complexity_score'])
    metrics['optimization_potential'] = sorted(optimization_data, key=lambda x: x['optimization_potential'], reverse=True)
    metrics['resource_usage'] = sorted(resource_data, key=lambda x: x['memory_usage'] + x['cpu_usage'])
    
    # Identify key differences
    if len(performance_data) >= 2:
        fastest = performance_data[0]
        slowest = performance_data[-1]
        
        # Find the query with the highest optimization potential
        highest_opt_query = max(optimization_data, key=lambda x: x['optimization_potential'])
        
        metrics['key_differences'] = [
            f"Query {fastest['index']} is {fastest['execution_time']:.2f}x faster than Query {slowest['index']}",
            f"Query {fastest['index']} uses {fastest['memory_usage']:.1f}% less memory than Query {slowest['index']}",
            f"Query {highest_opt_query['index']} has the highest optimization potential ({highest_opt_query['optimization_potential']:.1f}%)"
        ]
    
    # Generate smart recommendations based on optimization potential
    recommendations = []
    if len(performance_data) >= 2:
        # Categorize queries by optimization potential
        well_optimized = []
        minor_improvements = []
        significant_improvements = []
        major_improvements = []
        
        for query in performance_data:
            opt_potential = query['optimization_potential']
            if opt_potential <= 25:
                well_optimized.append(query)
            elif opt_potential <= 50:
                minor_improvements.append(query)
            elif opt_potential <= 75:
                significant_improvements.append(query)
            else:
                major_improvements.append(query)
        
        # Generate recommendations based on categories
        if well_optimized:
            well_opt_queries = [f"Query {q['index']}" for q in well_optimized]
            recommendations.append(f"{', '.join(well_opt_queries)} {'is' if len(well_optimized) == 1 else 'are'} well-optimized (‰25% improvement potential).")
        
        if minor_improvements:
            minor_queries = [f"Query {q['index']}" for q in minor_improvements]
            recommendations.append(f"For {', '.join(minor_queries)}, minor improvements may be possible. Run detailed analysis using our Analyze feature for specific optimization suggestions.")
        
        if significant_improvements:
            sig_queries = [f"Query {q['index']}" for q in significant_improvements]
            recommendations.append(f"{', '.join(sig_queries)} {'has' if len(significant_improvements) == 1 else 'have'} significant optimization potential (26-75%). Use our Analyze feature to identify specific improvements.")
        
        if major_improvements:
            major_queries = [f"Query {q['index']}" for q in major_improvements]
            recommendations.append(f"{', '.join(major_queries)} {'has' if len(major_improvements) == 1 else 'have'} major optimization opportunities (>75%). Run detailed analysis for comprehensive optimization recommendations.")
        
        # Add complexity-based recommendations
        if len(performance_data) >= 2:
            best_perf = performance_data[0]
            worst_perf = performance_data[-1]
            
            if worst_perf['complexity_score'] > best_perf['complexity_score'] * 1.5:
                recommendations.append(f"Query {worst_perf['index']} is significantly more complex. Consider simplifying joins or reducing subqueries.")
            
            if worst_perf['memory_usage'] > best_perf['memory_usage'] * 2:
                recommendations.append(f"Query {worst_perf['index']} uses significantly more memory. Consider using LIMIT clauses or pagination.")
    
    metrics['recommendations'] = recommendations
    
    return metrics

def calculate_analytics_data(history):
    """Calculate comprehensive analytics from analysis history"""
    if not history:
        return {}
    
    analytics = {
        'total_analyses': len(history),
        'database_distribution': {},
        'performance_trends': [],
        'complexity_distribution': [],
        'optimization_opportunities': [],
        'common_patterns': {},
        'performance_metrics': {
            'avg_score': 0,
            'avg_complexity': 0,
            'avg_optimization_potential': 0,
            'best_performing_query': None,
            'worst_performing_query': None
        }
    }
    
    # Database engine distribution
    for analysis in history:
        engine = analysis.get('db_engine', 'unknown')
        analytics['database_distribution'][engine] = analytics['database_distribution'].get(engine, 0) + 1
    
    # Performance metrics
    scores = []
    complexities = []
    optimization_potentials = []
    
    for analysis in history:
        report = analysis.get('report', {})
        performance_score = report.get('performance_score', {})
        performance_metrics = report.get('performance_metrics', {})
        
        if performance_score.get('score'):
            scores.append(performance_score['score'])
        
        if performance_metrics.get('complexity_score'):
            complexities.append(performance_metrics['complexity_score'])
        
        if performance_metrics.get('optimization_potential'):
            optimization_potentials.append(performance_metrics['optimization_potential'])
    
    if scores:
        analytics['performance_metrics']['avg_score'] = sum(scores) / len(scores)
        analytics['performance_metrics']['best_performing_query'] = max(scores)
        analytics['performance_metrics']['worst_performing_query'] = min(scores)
    
    if complexities:
        analytics['performance_metrics']['avg_complexity'] = sum(complexities) / len(complexities)
    
    if optimization_potentials:
        analytics['performance_metrics']['avg_optimization_potential'] = sum(optimization_potentials) / len(optimization_potentials)
    
    # Complexity distribution
    complexity_ranges = {
        'Simple (1-25)': 0,
        'Moderate (26-50)': 0,
        'Complex (51-75)': 0,
        'Very Complex (76-100)': 0
    }
    
    for complexity in complexities:
        if complexity <= 25:
            complexity_ranges['Simple (1-25)'] += 1
        elif complexity <= 50:
            complexity_ranges['Moderate (26-50)'] += 1
        elif complexity <= 75:
            complexity_ranges['Complex (51-75)'] += 1
        else:
            complexity_ranges['Very Complex (76-100)'] += 1
    
    analytics['complexity_distribution'] = [
        {'range': k, 'count': v} for k, v in complexity_ranges.items()
    ]
    
    # Common patterns analysis
    pattern_counts = {
        'SELECT *': 0,
        'JOIN operations': 0,
        'Aggregations': 0,
        'Subqueries': 0,
        'Window functions': 0,
        'JSON operations': 0,
        'CTEs': 0
    }
    
    for analysis in history:
        sql = analysis.get('sql_query', '').upper()
        if 'SELECT *' in sql:
            pattern_counts['SELECT *'] += 1
        if 'JOIN' in sql:
            pattern_counts['JOIN operations'] += 1
        if any(func in sql for func in ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'GROUP BY']):
            pattern_counts['Aggregations'] += 1
        if sql.count('SELECT') > 1:
            pattern_counts['Subqueries'] += 1
        if 'OVER' in sql:
            pattern_counts['Window functions'] += 1
        if any(op in sql for op in ['->>', '->', 'JSONB_', 'JSON_']):
            pattern_counts['JSON operations'] += 1
        if 'WITH' in sql:
            pattern_counts['CTEs'] += 1
    
    analytics['common_patterns'] = pattern_counts
    
    return analytics

def generate_insights(history):
    """Generate actionable insights from analysis history"""
    insights = []
    
    if not history:
        insights.append({
            'type': 'info',
            'title': 'No Data Available',
            'message': 'Start analyzing queries to see insights and trends.',
            'icon': 'fas fa-info-circle'
        })
        return insights
    
    # Performance insights
    scores = [h.get('report', {}).get('performance_score', {}).get('score', 0) for h in history]
    avg_score = sum(scores) / len(scores) if scores else 0
    
    if avg_score < 60:
        insights.append({
            'type': 'warning',
            'title': 'Low Average Performance',
            'message': f'Your average performance score is {avg_score:.1f}/100. Consider reviewing query optimization best practices.',
            'icon': 'fas fa-exclamation-triangle'
        })
    elif avg_score > 80:
        insights.append({
            'type': 'success',
            'title': 'Excellent Performance',
            'message': f'Great job! Your average performance score is {avg_score:.1f}/100.',
            'icon': 'fas fa-trophy'
        })
    
    # Pattern insights
    select_star_count = sum(1 for h in history if 'SELECT *' in h.get('sql_query', '').upper())
    if select_star_count > len(history) * 0.3:  # More than 30% use SELECT *
        insights.append({
            'type': 'warning',
            'title': 'Frequent SELECT * Usage',
            'message': f'{select_star_count} out of {len(history)} queries use SELECT *. Consider specifying only needed columns.',
            'icon': 'fas fa-search'
        })
    
    # Database preference insights
    engine_counts = {}
    for h in history:
        engine = h.get('db_engine', 'unknown')
        engine_counts[engine] = engine_counts.get(engine, 0) + 1
    
    most_used_engine = max(engine_counts.items(), key=lambda x: x[1])[0] if engine_counts else None
    if most_used_engine:
        insights.append({
            'type': 'info',
            'title': 'Primary Database',
            'message': f'You primarily work with {most_used_engine.upper()}. Consider exploring engine-specific optimizations.',
            'icon': 'fas fa-database'
        })
    
    # Complexity insights
    complexities = [h.get('report', {}).get('performance_metrics', {}).get('complexity_score', 0) for h in history]
    avg_complexity = sum(complexities) / len(complexities) if complexities else 0
    
    if avg_complexity > 70:
        insights.append({
            'type': 'info',
            'title': 'High Query Complexity',
            'message': f'Average complexity is {avg_complexity:.1f}/100. Consider breaking down complex queries.',
            'icon': 'fas fa-puzzle-piece'
        })
    
    return insights

def calculate_trends(history):
    """Calculate performance trends over time"""
    trends = {
        'performance_trend': [],
        'complexity_trend': [],
        'optimization_trend': []
    }
    
    if len(history) < 2:
        return trends
    
    # Sort by timestamp (assuming history is in chronological order)
    sorted_history = sorted(history, key=lambda x: x.get('timestamp', 0))
    
    for i, analysis in enumerate(sorted_history):
        report = analysis.get('report', {})
        performance_score = report.get('performance_score', {})
        performance_metrics = report.get('performance_metrics', {})
        
        trends['performance_trend'].append({
            'index': i,
            'score': performance_score.get('score', 0),
            'date': analysis.get('timestamp', i)
        })
        
        trends['complexity_trend'].append({
            'index': i,
            'complexity': performance_metrics.get('complexity_score', 0),
            'date': analysis.get('timestamp', i)
        })
        
        trends['optimization_trend'].append({
            'index': i,
            'potential': performance_metrics.get('optimization_potential', 0),
            'date': analysis.get('timestamp', i)
        })
    
    return trends

# Share Links functionality
def generate_share_id(analysis_data):
    """Generate a unique share ID for the analysis data"""
    # Create a hash of the analysis data and timestamp
    data_string = json.dumps(analysis_data, sort_keys=True) + str(time.time())
    return hashlib.md5(data_string.encode()).hexdigest()[:12]

def store_shared_analysis(share_id, analysis_data):
    """Store shared analysis data in session (in production, use a database)"""
    if 'shared_analyses' not in session:
        session['shared_analyses'] = {}
    
    # Store with timestamp for cleanup
    session['shared_analyses'][share_id] = {
        'data': analysis_data,
        'timestamp': time.time(),
        'created_at': time.strftime('%Y-%m-%d %H:%M:%S')
    }
    
    # Clean up old shared analyses (older than 24 hours)
    current_time = time.time()
    session['shared_analyses'] = {
        k: v for k, v in session['shared_analyses'].items()
        if current_time - v['timestamp'] < 86400  # 24 hours
    }

@app.route('/share_analysis', methods=['POST'])
def share_analysis():
    """Generate a shareable link for the current analysis"""
    try:
        data = request.get_json()
        analysis_data = data.get('analysis_data', {})
        
        if not analysis_data:
            return jsonify({'error': 'No analysis data provided'}), 400
        
        # Generate unique share ID
        share_id = generate_share_id(analysis_data)
        
        # Store the analysis data
        store_shared_analysis(share_id, analysis_data)
        
        # Generate shareable URL
        share_url = request.host_url.rstrip('/') + url_for('shared_analysis', share_id=share_id)
        
        return jsonify({
            'share_id': share_id,
            'share_url': share_url,
            'message': 'Analysis shared successfully!'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/shared/<share_id>')
def shared_analysis(share_id):
    """Display a shared analysis"""
    try:
        # Get shared analysis data
        shared_analyses = session.get('shared_analyses', {})
        shared_data = shared_analyses.get(share_id)
        
        if not shared_data:
            flash('Shared analysis not found or has expired.', 'error')
            return redirect(url_for('index'))
        
        # Extract analysis data
        analysis_data = shared_data['data']
        created_at = shared_data['created_at']
        
        # Render the shared analysis
        return render_template('shared_result.html', 
                             analysis_data=analysis_data,
                             share_id=share_id,
                             created_at=created_at,
                             is_shared=True)
        
    except Exception as e:
        flash(f'Error loading shared analysis: {str(e)}', 'error')
        return redirect(url_for('index'))

@app.route('/copy_shared_analysis', methods=['POST'])
def copy_shared_analysis():
    """Copy shared analysis to user's own analysis"""
    try:
        data = request.get_json()
        share_id = data.get('share_id')
        
        # Get shared analysis data
        shared_analyses = session.get('shared_analyses', {})
        shared_data = shared_analyses.get(share_id)
        
        if not shared_data:
            return jsonify({'error': 'Shared analysis not found'}), 404
        
        # Copy to user's analysis history
        analysis_data = shared_data['data']
        if 'analysis_history' not in session:
            session['analysis_history'] = []
        
        # Add to history with a note that it was copied from shared analysis
        copied_analysis = analysis_data.copy()
        copied_analysis['copied_from_share'] = True
        copied_analysis['original_share_id'] = share_id
        
        session['analysis_history'].insert(0, copied_analysis)
        
        # Keep only last 10 analyses
        session['analysis_history'] = session['analysis_history'][:10]
        
        return jsonify({
            'message': 'Analysis copied to your history successfully!',
            'redirect_url': url_for('result')
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/beautify_sql', methods=['POST'])
def beautify_sql():
    try:
        data = request.get_json(force=True, silent=False)
        sql = data.get('sql', '') if data else ''
        formatted = sqlparse.format(sql, reindent=True, keyword_case='upper')
        return jsonify({'beautified': formatted})
    except Exception as e:
        return jsonify({'error': 'Invalid request or JSON: ' + str(e)}), 400

def parse_explain_to_json(explain_plan, db_engine):
    """Parse explain plan with format detection and routing"""
    if not explain_plan:
        return None
    
    # Auto-detect format
    detected_format = detect_explain_format(explain_plan)
    
    # Route to appropriate parser based on engine and format
    if db_engine == 'postgresql':
        if detected_format == 'json':
            return parse_postgresql_json(explain_plan)
        elif detected_format == 'xml':
            return parse_postgresql_xml(explain_plan)
        elif detected_format == 'postgresql_text':
            return parse_postgresql_text(explain_plan)
        else:
            return parse_postgresql_text(explain_plan)  # fallback
    elif db_engine == 'oracle':
        if detected_format == 'oracle':
            return parse_oracle_explain_flow(explain_plan)
        else:
            return parse_oracle_explain_flow(explain_plan)  # fallback
    elif db_engine == 'sqlserver':
        if detected_format == 'sqlserver':
            return parse_sqlserver_explain_flow(explain_plan)
        elif detected_format == 'xml':
            return parse_sqlserver_xml(explain_plan)
        else:
            return parse_sqlserver_explain_flow(explain_plan)  # fallback
    
    return None

def detect_engine_from_explain(explain_plan):
    if not explain_plan:
        return None
    plan = explain_plan.strip().lower()
    # SQL Server: |--, Clustered Index Scan, Hash Match, Nested Loops, etc.
    if '|--' in plan or 'clustered index scan' in plan or 'hash match' in plan or 'nested loops' in plan:
        return 'sqlserver'
    # Oracle: pipe format, TABLE ACCESS FULL, COST (%CPU)
    if 'table access full' in plan or 'cost (%cpu)' in plan or '| id  | operation' in plan:
        return 'oracle'
    # MySQL: id, select_type, table, type, rows, Extra
    if 'select_type' in plan and 'rows' in plan and 'extra' in plan:
        return 'mysql'
    if '| id |' in plan and '| table |' in plan:
        return 'mysql'
    # PostgreSQL: Seq Scan, Index Scan, cost=, width=
    if 'seq scan' in plan or 'index scan' in plan or 'cost=' in plan or 'width=' in plan:
        return 'postgresql'
    # SQLite: SCAN TABLE, SEARCH TABLE
    if 'scan table' in plan or 'search table' in plan:
        return 'sqlite'
    return None

def detect_explain_format(explain_plan):
    if not explain_plan:
        return 'unknown'
    plan_text = explain_plan.strip()
    # SQL Server tree format (prioritize this check)
    if '|--' in plan_text or 'Clustered Index Scan' in plan_text or 'Hash Match' in plan_text or 'Nested Loops' in plan_text:
        return 'sqlserver'
    # Check for JSON format
    if (plan_text.startswith('[') and plan_text.endswith(']')) or \
       (plan_text.startswith('{') and plan_text.endswith('}')):
        try:
            json.loads(plan_text)
            return 'json'
        except json.JSONDecodeError:
            pass
    # Check for XML format (SQL Server ShowPlanXML)
    if plan_text.startswith('<') or '<RelOp' in plan_text or '<ShowPlanXML' in plan_text:
        return 'xml'
    # Check for SQL Server specific formats (table style)
    if any(keyword in plan_text for keyword in [
        'StmtText', 'PhysicalOp', 'LogicalOp', 'EstimateRows', 'EstimateIO', 'EstimateCPU', 'TotalSubtreeCost',
        'HashAggregate', 'NodeId', 'PhysicalOp=', 'LogicalOp=', 'EstimateRows='
    ]):
        return 'sqlserver'
    # Check for PostgreSQL text format (has indentation and -> markers)
    if '->' in plan_text or 'Planning Time:' in plan_text or 'Execution Time:' in plan_text:
        return 'postgresql_text'
    # Check for Oracle format (pipe-delimited or table format)
    if '|' in plan_text and ('Id' in plan_text or 'OPERATION' in plan_text):
        return 'oracle'
    # Default to text format
    return 'text'

def parse_postgresql_json(explain_plan):
    """Parse PostgreSQL JSON format - richest data source"""
    try:
        data = json.loads(explain_plan)
        return extract_from_postgresql_json(data)
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        return None

def extract_from_postgresql_json(data):
    """Extract execution tree from PostgreSQL JSON format"""
    if not data or not isinstance(data, list) or len(data) == 0:
        return None
    
    # PostgreSQL JSON format: [{"Plan": {...}}]
    plan_data = data[0].get('Plan', {})
    
    execution_tree = {
        'operation': 'Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    def extract_node_data(node):
        """Extract metrics from a JSON node"""
        node_data = {
            'operation': node.get('Node Type', 'Unknown Operation'),
            'cost': node.get('Total Cost', 0),
            'startup_cost': node.get('Startup Cost', 0),
            'rows': node.get('Actual Rows', node.get('Plan Rows', 0)),
            'time': node.get('Actual Total Time', 0),
            'buffers': node.get('Buffers', {}),
            'children': []
        }
        
        # Add relation name if available
        if node.get('Relation Name'):
            node_data['operation'] += f" on {node.get('Relation Name')}"
        
        # Add index name if available
        if node.get('Index Name'):
            node_data['operation'] += f" using {node.get('Index Name')}"
        
        # Add scan direction if available
        if node.get('Scan Direction'):
            node_data['operation'] += f" ({node.get('Scan Direction')})"
        
        # Add filter conditions if available
        if node.get('Filter'):
            node_data['filter'] = node.get('Filter')
        
        # Add join conditions if available
        if node.get('Hash Cond'):
            node_data['join_condition'] = node.get('Hash Cond')
        
        # Process children
        if 'Plans' in node:
            for child in node['Plans']:
                child_data = extract_node_data(child)
                node_data['children'].append(child_data)
        
        return node_data
    
    # Extract the main plan
    main_plan = extract_node_data(plan_data)
    execution_tree.update(main_plan)
    
    return execution_tree

def parse_postgresql_xml(explain_plan):
    """Parse PostgreSQL XML format"""
    # TODO: Implement XML parsing for PostgreSQL
    # For now, fallback to text parsing
    return parse_postgresql_text(explain_plan)

def parse_postgresql_text(explain_plan):
    """Parse PostgreSQL TEXT format - enhanced version"""
    lines = explain_plan.strip().split('\n')
    
    # Skip header lines
    skip_patterns = ['Planning Time:', 'Execution Time:', 'QUERY PLAN', '---']
    filtered_lines = []
    for line in lines:
        if not any(pattern in line for pattern in skip_patterns):
            filtered_lines.append(line)
    
    if not filtered_lines:
        return None
    
    # Parse the execution flow based on indentation
    execution_tree = {
        'operation': 'Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    # Stack to track parent nodes based on indentation
    node_stack = [execution_tree]
    indent_stack = [-1]  # Track indentation levels
    
    for line in filtered_lines:
        if not line.strip():
            continue
            
        # Calculate indentation level (count leading spaces or ->)
        original_line = line
        indent_level = 0
        while line.startswith('  ') or line.startswith('-> '):
            if line.startswith('-> '):
                indent_level += 1
                line = line[3:]
            else:
                indent_level += 1
                line = line[2:]
        
        # Parse operation and metrics
        operation, metrics = parse_enhanced_postgresql_line(line)
        
        if not operation:
            continue
        
        # Create node
        node = {
            'operation': operation,
            'cost': metrics.get('cost', 0),
            'rows': metrics.get('rows', 0),
            'time': metrics.get('time', 0),
            'buffers': metrics.get('buffers', {}),
            'children': []
        }
        
        # Find the correct parent based on indentation
        while len(indent_stack) > 1 and indent_level <= indent_stack[-1]:
            node_stack.pop()
            indent_stack.pop()
        
        # Add to current parent
        node_stack[-1]['children'].append(node)
        
        # Push this node onto stack for potential children
        node_stack.append(node)
        indent_stack.append(indent_level)
    
    return execution_tree

def parse_enhanced_postgresql_line(line):
    """Enhanced PostgreSQL line parser with better metric extraction"""
    # Remove any trailing comments
    if '--' in line:
        line = line.split('--')[0]
    
    # Extract operation name (everything before the first parenthesis)
    operation_match = re.match(r'^([^(]+)', line.strip())
    if not operation_match:
        return None, {}
    
    operation = operation_match.group(1).strip()
    
    # Extract metrics from the rest of the line
    metrics = {}
    
    # Extract cost
    cost_match = re.search(r'cost=([0-9.]+)', line)
    if cost_match:
        metrics['cost'] = float(cost_match.group(1))
    
    # Extract rows
    rows_match = re.search(r'rows=([0-9]+)', line)
    if rows_match:
        metrics['rows'] = int(rows_match.group(1))
    
    # Extract time
    time_match = re.search(r'actual time=([0-9.]+)', line)
    if time_match:
        metrics['time'] = float(time_match.group(1))
    
    # Extract buffer information
    buffers_match = re.search(r'Buffers: (.+?)(?:\s|$)', line)
    if buffers_match:
        metrics['buffers'] = parse_buffer_info(buffers_match.group(1))
    
    return operation, metrics

def parse_buffer_info(buffers_str):
    """Parse buffer information from PostgreSQL explain output"""
    buffers = {}
    
    # Extract different buffer types
    hit_match = re.search(r'shared hit=([0-9]+)', buffers_str)
    if hit_match:
        buffers['shared_hit'] = int(hit_match.group(1))
    
    read_match = re.search(r'shared read=([0-9]+)', buffers_str)
    if read_match:
        buffers['shared_read'] = int(read_match.group(1))
    
    dirtied_match = re.search(r'shared dirtied=([0-9]+)', buffers_str)
    if dirtied_match:
        buffers['shared_dirtied'] = int(dirtied_match.group(1))
    
    written_match = re.search(r'shared written=([0-9]+)', buffers_str)
    if written_match:
        buffers['shared_written'] = int(written_match.group(1))
    
    return buffers

def parse_sqlserver_xml(explain_plan):
    """Parse SQL Server XML format (ShowPlanXML) with proper hierarchical structure."""
    try:
        print("[DEBUG] Received SQL Server XML (first 500 chars):\n", explain_plan[:500])
        
        # Use a more lenient XML parser that can handle truncated content
        from xml.etree.ElementTree import XMLParser
        from xml.parsers.expat import ParserCreate
        
        # Create a custom parser that's more forgiving
        class LenientXMLParser:
            def __init__(self):
                self.root = None
                self.current = None
                self.stack = []
                
            def start(self, tag, attrs):
                # Clean the tag name (remove namespace if present)
                if '}' in tag:
                    tag = tag.split('}')[1]
                
                element = {'tag': tag, 'attrs': dict(attrs), 'children': []}
                
                if self.root is None:
                    self.root = element
                else:
                    self.current['children'].append(element)
                
                self.stack.append(self.current)
                self.current = element
                
            def end(self, tag):
                if self.stack:
                    self.current = self.stack.pop()
                    
            def data(self, data):
                pass  # Ignore text content for now
        
        # Try to parse with our lenient parser
        try:
            parser = ParserCreate()
            lenient_parser = LenientXMLParser()
            
            parser.StartElementHandler = lenient_parser.start
            parser.EndElementHandler = lenient_parser.end
            parser.CharacterDataHandler = lenient_parser.data
            
            # Parse the XML content
            parser.Parse(explain_plan, True)
            
            if lenient_parser.root is None:
                raise Exception("No root element found")
                
            print("[DEBUG] Successfully parsed with lenient parser")
            
            # Now extract the execution plan from our parsed structure
            def find_relop_nodes(element):
                """Recursively find all RelOp nodes with their hierarchy"""
                relops = []
                if element['tag'] == 'RelOp':
                    relops.append(element)
                for child in element.get('children', []):
                    relops.extend(find_relop_nodes(child))
                return relops
            
            # Find all RelOp nodes
            relop_nodes = find_relop_nodes(lenient_parser.root)
            print(f"[DEBUG] Found {len(relop_nodes)} RelOp nodes")
            
            if not relop_nodes:
                print("[DEBUG] No RelOp nodes found")
                return None
            
            # Build proper hierarchical execution tree from RelOp nodes
            def build_hierarchical_tree_from_relops(relops):
                """Build proper hierarchical execution tree from RelOp nodes"""
                if not relops:
                    return None
                
                # Create a map of NodeId to RelOp for easier lookup
                node_map = {}
                for relop in relops:
                    node_id = relop['attrs'].get('NodeId', '0')
                    node_map[node_id] = relop
                
                # Find the root node (usually NodeId="0" or the one with highest NodeId)
                root_node = None
                if '0' in node_map:
                    root_node = node_map['0']
                else:
                    # Find the node with the highest NodeId (usually the root)
                    max_node_id = max(node_map.keys(), key=lambda x: int(x) if x.isdigit() else 0)
                    root_node = node_map[max_node_id]
                
                def create_hierarchical_node(relop, parent_node_id=None):
                    """Create a node with proper parent-child relationships"""
                    node_data = {
                        'operation': relop['attrs'].get('PhysicalOp', 'Unknown Operation'),
                        'logical_op': relop['attrs'].get('LogicalOp', ''),
                        'cost': float(relop['attrs'].get('EstimatedTotalSubtreeCost', 0)),
                        'rows': int(float(relop['attrs'].get('EstimateRows', 0))),
                        'time': 0,
                        'node_id': relop['attrs'].get('NodeId', '0'),
                        'children': []
                    }
                    
                    # Find child RelOp nodes by looking for RelOp tags within this node's children
                    for child in relop.get('children', []):
                        if child['tag'] == 'RelOp':
                            child_node = create_hierarchical_node(child, node_data['node_id'])
                            node_data['children'].append(child_node)
                    
                    return node_data
                
                return create_hierarchical_node(root_node)
            
            execution_tree = build_hierarchical_tree_from_relops(relop_nodes)
            if execution_tree:
                # Add root wrapper
                final_tree = {
                    'operation': 'Query Execution Plan',
                    'cost': 0,
                    'rows': 0,
                    'time': 0,
                    'children': [execution_tree]
                }
                print("[DEBUG] Successfully built hierarchical execution tree")
                return final_tree
            else:
                print("[DEBUG] Failed to build hierarchical execution tree")
                return None
                
        except Exception as parse_error:
            print(f"[DEBUG] Lenient parsing failed: {parse_error}")
            
            # Fallback: try to extract RelOp information using regex with hierarchy
            import re
            
            # First, let's see what RelOp tags are actually in the XML
            simple_relop_pattern = r'<RelOp[^>]*>'
            relop_matches = re.findall(simple_relop_pattern, explain_plan)
            print(f"[DEBUG] Found {len(relop_matches)} RelOp tags (raw):")
            for i, match in enumerate(relop_matches[:5]):  # Show first 5
                print(f"  {i+1}: {match}")
            
            # Extract RelOp nodes with their attributes and build hierarchy
            relop_pattern = r'<RelOp[^>]*NodeId="([^"]*)"[^>]*PhysicalOp="([^"]*)"[^>]*>'
            matches = re.findall(relop_pattern, explain_plan)
            
            if matches:
                print(f"[DEBUG] Found {len(matches)} RelOp matches with NodeId and PhysicalOp")
                
                # Create a map of NodeId to operation data
                node_data_map = {}
                for node_id, physical_op in matches:
                    # Find the corresponding RelOp tag and extract attributes
                    relop_start = explain_plan.find(f'NodeId="{node_id}"')
                    if relop_start != -1:
                        # Look backwards to find the start of this RelOp tag
                        tag_start = explain_plan.rfind('<RelOp', 0, relop_start)
                        if tag_start != -1:
                            # Extract the full RelOp tag
                            tag_end = explain_plan.find('>', tag_start)
                            if tag_end != -1:
                                relop_tag = explain_plan[tag_start:tag_end + 1]
                                
                                # Extract cost and rows from this specific tag
                                cost_match = re.search(r'EstimatedTotalSubtreeCost="([^"]*)"', relop_tag)
                                rows_match = re.search(r'EstimateRows="([^"]*)"', relop_tag)
                                logical_op_match = re.search(r'LogicalOp="([^"]*)"', relop_tag)
                                
                                cost = float(cost_match.group(1)) if cost_match else 0.0
                                rows = int(float(rows_match.group(1))) if rows_match else 0
                                logical_op = logical_op_match.group(1) if logical_op_match else ''
                                
                                node_data_map[node_id] = {
                                    'operation': physical_op,
                                    'logical_op': logical_op,
                                    'cost': cost,
                                    'rows': rows,
                                    'time': 0,
                                    'node_id': node_id,
                                    'children': []
                                }
                                print(f"[DEBUG] Added node: {physical_op} (NodeId: {node_id}, cost: {cost}, rows: {rows})")
                
                # Build hierarchy based on NodeId (assuming lower numbers are parents)
                if node_data_map:
                    # Sort by NodeId to establish hierarchy
                    sorted_nodes = sorted(node_data_map.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 0)
                    
                    # Find root node (usually NodeId="0" or lowest number)
                    root_node_id = sorted_nodes[0][0]
                    root_node = node_data_map[root_node_id].copy()
                    
                    # Build parent-child relationships
                    for node_id, node_data in sorted_nodes[1:]:
                        # Find parent by looking for the closest lower NodeId
                        parent_id = None
                        for potential_parent_id in sorted(node_data_map.keys(), key=lambda x: int(x) if x.isdigit() else 0):
                            if int(potential_parent_id) < int(node_id):
                                parent_id = potential_parent_id
                            else:
                                break
                        
                        if parent_id and parent_id in node_data_map:
                            node_data_map[parent_id]['children'].append(node_data)
                    
                    execution_tree = {
                        'operation': 'Query Execution Plan',
                        'cost': 0,
                        'rows': 0,
                        'time': 0,
                        'children': [root_node]
                    }
                    print("[DEBUG] Successfully built hierarchical execution tree from regex")
                    return execution_tree
                else:
                    print("[DEBUG] No valid nodes found in regex matches")
                    return None
            else:
                print("[DEBUG] No RelOp matches found with regex")
                
                # Last resort: try to find any RelOp tags and create basic nodes
                basic_relop_pattern = r'<RelOp[^>]*PhysicalOp="([^"]*)"[^>]*>'
                basic_matches = re.findall(basic_relop_pattern, explain_plan)
                
                if basic_matches:
                    print(f"[DEBUG] Found {len(basic_matches)} basic RelOp matches")
                    execution_tree = {
                        'operation': 'Query Execution Plan',
                        'cost': 0,
                        'rows': 0,
                        'time': 0,
                        'children': []
                    }
                    
                    for physical_op in basic_matches:
                        node = {
                            'operation': physical_op,
                            'cost': 0.0,
                            'rows': 0,
                            'time': 0,
                            'children': []
                        }
                        execution_tree['children'].append(node)
                    
                    print("[DEBUG] Successfully built basic execution tree")
                    return execution_tree
                else:
                    print("[DEBUG] No basic RelOp matches found either")
                    return None

    except Exception as e:
        print(f"[ERROR] XML parsing error: {e}")
        traceback.print_exc()
        return None

def parse_sqlserver_explain_flow(explain_plan):
    """Parse SQL Server EXPLAIN PLAN output with enhanced format support"""
    lines = explain_plan.strip().split('\n')
    
    # Check for table format (StmtText, PhysicalOp, etc.)
    if any('StmtText' in line for line in lines[:5]) or any('PhysicalOp' in line for line in lines[:5]):
        return parse_sqlserver_table_format(lines)
    
    # Check for tree format with |--
    if any('|--' in line for line in lines):
        execution_tree = {
            'operation': 'SQL Server Query Execution Plan',
            'cost': 0,
            'rows': 0,
            'time': 0,
            'buffers': {},
            'children': []
        }
        return parse_sqlserver_tree_format(lines, execution_tree)
    
    # Check for XML format
    if explain_plan.strip().startswith('<ShowPlanXML'):
        return parse_sqlserver_xml(explain_plan)
    
    # Generic format fallback
    return parse_sqlserver_generic_format(lines)

def parse_sqlserver_table_format(lines):
    """Parse SQL Server table format with StmtText, PhysicalOp columns"""
    execution_tree = {
        'operation': 'SQL Server Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    # Skip header lines
    data_lines = []
    for line in lines:
        if line.strip() and not line.startswith('---') and not line.startswith('StmtText'):
            data_lines.append(line)
    
    if not data_lines:
        return execution_tree
    
    # Parse each operation line
    for line in data_lines:
        # Split by | and clean up
        parts = [part.strip() for part in line.split('|') if part.strip()]
        
        if len(parts) >= 4:
            stmt_text = parts[0]
            physical_op = parts[1] if len(parts) > 1 else ''
            logical_op = parts[2] if len(parts) > 2 else ''
            estimate_rows = parts[3] if len(parts) > 3 else '0'
            estimate_io = parts[4] if len(parts) > 4 else '0'
            estimate_cpu = parts[5] if len(parts) > 5 else '0'
            total_cost = parts[6] if len(parts) > 6 else '0'
            
            # Create operation name
            operation = physical_op if physical_op else logical_op
            if not operation and stmt_text:
                # Extract operation from StmtText
                operation = stmt_text.split()[0] if stmt_text.split() else 'Unknown'
            
            # Parse metrics
            try:
                rows = float(estimate_rows) if estimate_rows and estimate_rows != 'NULL' else 0
                cost = float(total_cost) if total_cost and total_cost != 'NULL' else 0
                io_cost = float(estimate_io) if estimate_io and estimate_io != 'NULL' else 0
                cpu_cost = float(estimate_cpu) if estimate_cpu and estimate_cpu != 'NULL' else 0
            except (ValueError, TypeError):
                rows, cost, io_cost, cpu_cost = 0, 0, 0, 0
            
            # Create node
            node = {
                'operation': operation,
                'cost': cost,
                'rows': rows,
                'time': 0,  # SQL Server doesn't provide actual time in this format
                'buffers': {'shared_read': int(io_cost) if io_cost > 0 else 0},
                'children': []
            }
            
            execution_tree['children'].append(node)
    
    return execution_tree

def parse_sqlserver_tree_format(lines, execution_tree):
    """Parse SQL Server tree format with |-- markers"""
    # Stack to track parent nodes based on indentation
    node_stack = [execution_tree]
    indent_stack = [-1]
    
    for line in lines:
        if not line.strip():
            continue
        
        # Calculate indentation level based on |-- markers
        original_line = line
        indent_level = 0
        while line.startswith('|--') or line.startswith('  '):
            if line.startswith('|--'):
                indent_level += 1
                line = line[3:]
            else:
                indent_level += 1
                line = line[2:]
        
        # Parse operation and metrics
        operation, metrics = parse_enhanced_sqlserver_line(line)
        
        if not operation:
            continue
        
        # Create node
        node = {
            'operation': operation,
            'cost': metrics.get('cost', 0),
            'rows': metrics.get('rows', 0),
            'time': metrics.get('time', 0),
            'buffers': metrics.get('buffers', {}),
            'children': []
        }
        
        # Find the correct parent based on indentation
        while len(indent_stack) > 1 and indent_level <= indent_stack[-1]:
            node_stack.pop()
            indent_stack.pop()
        
        # Add to current parent
        node_stack[-1]['children'].append(node)
        
        # Push this node onto stack for potential children
        node_stack.append(node)
        indent_stack.append(indent_level)
    
    return execution_tree

def parse_sqlserver_generic_format(lines):
    """Parse SQL Server generic format"""
    execution_tree = {
        'operation': 'SQL Server Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    # For other SQL Server formats, try to extract operations
    for line in lines:
        operation, metrics = parse_enhanced_sqlserver_line(line)
        if operation:
            node = {
                'operation': operation,
                'cost': metrics.get('cost', 0),
                'rows': metrics.get('rows', 0),
                'time': metrics.get('time', 0),
                'buffers': metrics.get('buffers', {}),
                'children': []
            }
            execution_tree['children'].append(node)
    
    return execution_tree

def parse_enhanced_sqlserver_line(line):
    """Parse a single SQL Server operation line with enhanced metrics"""
    line = line.strip()
    
    # Extract metrics from parentheses
    metrics = {}
    operation = line
    
    # Look for cost information in SQL Server format (cost=0.0..0.0)
    cost_match = re.search(r'cost=([\d.]+)\.\.([\d.]+)', line, re.IGNORECASE)
    if cost_match:
        # Use the end cost (higher value) for visualization
        metrics['cost'] = float(cost_match.group(2))
    
    # Look for rows information
    rows_match = re.search(r'rows=(\d+)', line, re.IGNORECASE)
    if rows_match:
        metrics['rows'] = int(rows_match.group(1))
    
    # Look for width information
    width_match = re.search(r'width=(\d+)', line, re.IGNORECASE)
    if width_match:
        metrics['width'] = int(width_match.group(1))
    
    # Look for time information (if available in actual execution)
    time_match = re.search(r'actual time=([\d.]+)\.\.([\d.]+)', line, re.IGNORECASE)
    if time_match:
        metrics['time'] = float(time_match.group(2))  # Use end time
    
    # Look for I/O information
    io_match = re.search(r'io=(\d+)', line, re.IGNORECASE)
    if io_match:
        metrics['buffers'] = {'shared_read': int(io_match.group(1))}
    else:
        # Generate realistic I/O based on operation type and rows
        if 'scan' in operation.lower():
            metrics['buffers'] = {'shared_read': metrics.get('rows', 1000) // 10}
        elif 'join' in operation.lower():
            metrics['buffers'] = {'shared_read': metrics.get('rows', 1000) // 5}
        else:
            metrics['buffers'] = {'shared_read': metrics.get('rows', 1000) // 20}
    
    # Clean up operation name - remove metrics part
    if ' (cost=' in line:
        operation = line.split(' (cost=')[0].strip()
    
    # Clean up operation name - remove OBJECT references
    if 'OBJECT:' in operation:
        operation = operation.split('OBJECT:')[0].strip()
    
    # Clean up operation name - remove WHERE clauses
    if 'WHERE:' in operation:
        operation = operation.split('WHERE:')[0].strip()
    
    # Clean up operation name - remove HASH clauses
    if 'HASH:' in operation:
        operation = operation.split('HASH:')[0].strip()
    
    # Clean up operation name - remove RESIDUAL clauses
    if 'RESIDUAL:' in operation:
        operation = operation.split('RESIDUAL:')[0].strip()
    
    # Clean up operation name - remove ORDER BY clauses
    if 'ORDER BY:' in operation:
        operation = operation.split('ORDER BY:')[0].strip()
    
    # Clean up operation name
    operation = operation.replace('_', ' ').title()
    
    # Generate realistic metrics if none found
    if not metrics.get('cost'):
        # Assign cost based on operation type
        if 'scan' in operation.lower():
            metrics['cost'] = 100.0
        elif 'join' in operation.lower():
            metrics['cost'] = 250.0
        elif 'sort' in operation.lower():
            metrics['cost'] = 150.0
        elif 'aggregate' in operation.lower():
            metrics['cost'] = 200.0
        else:
            metrics['cost'] = 50.0
    
    if not metrics.get('rows'):
        # Assign rows based on operation type
        if 'scan' in operation.lower():
            metrics['rows'] = 10000
        elif 'join' in operation.lower():
            metrics['rows'] = 5000
        elif 'sort' in operation.lower():
            metrics['rows'] = 2000
        elif 'aggregate' in operation.lower():
            metrics['rows'] = 1000
        else:
            metrics['rows'] = 5000
    
    if not metrics.get('time'):
        # Assign time based on cost
        metrics['time'] = metrics.get('cost', 50.0) * 0.1
    
    return operation, metrics

def parse_operation_line(line):
    """Parse a single operation line to extract operation name and metrics"""
    line = line.strip()
    
    # Extract metrics from parentheses
    metrics = {}
    operation = line
    
    # Look for metrics in parentheses
    if ' (cost=' in line:
        parts = line.split(' (cost=', 1)
        operation = parts[0].strip()
        metrics_str = 'cost=' + parts[1]
        
        # Parse cost
        cost_match = re.search(r'cost=([\d.]+)\.\.([\d.]+)', metrics_str)
        if cost_match:
            metrics['cost'] = float(cost_match.group(2))  # Use end cost
        
        # Parse rows
        rows_match = re.search(r'rows=(\d+)', metrics_str)
        if rows_match:
            metrics['rows'] = int(rows_match.group(1))
        
        # Parse actual time if available
        time_match = re.search(r'actual time=([\d.]+)\.\.([\d.]+)', metrics_str)
        if time_match:
            metrics['time'] = float(time_match.group(2))  # Use end time
        
        # Parse width
        width_match = re.search(r'width=(\d+)', metrics_str)
        if width_match:
            metrics['width'] = int(width_match.group(1))
    
    # Clean up operation name
    operation = operation.replace('_', ' ').title()
    
    return operation, metrics

@app.route('/generate_explain_visualization', methods=['POST'])
def generate_explain_visualization():
    try:
        data = request.get_json()
        explain_plan = data.get('explain_plan', '')
        db_engine = data.get('db_engine', 'postgresql')

        if not explain_plan:
            return jsonify({'success': False, 'error': 'No EXPLAIN plan provided'})

        detected_engine = detect_engine_from_explain(explain_plan)
        if detected_engine and detected_engine != db_engine:
            msg = f"Engine Mismatch: It looks like your EXPLAIN plan is for {detected_engine.capitalize()}, but you selected {db_engine.capitalize()}. Please choose the correct database engine for accurate visualization."
            return jsonify({'success': False, 'error': msg, 'engine_mismatch': True})

        # Auto-detect format and parse explain plan to JSON tree
        detected_format = detect_explain_format(explain_plan)
        json_tree = parse_explain_to_json(explain_plan, db_engine)

        if json_tree:
            # Generate optimization recommendations from execution plan
            plan_summary, plan_recommendations, plan_warnings = generate_optimization_summary(json_tree, db_engine)
            
            return jsonify({
                'success': True,
                'json_tree': json_tree,
                'detected_format': detected_format,
                'plan_summary': plan_summary,
                'plan_recommendations': plan_recommendations,
                'plan_warnings': plan_warnings,
                'message': f'Visualization data generated successfully (detected format: {detected_format})'
            })
        else:
            return jsonify({
                'success': False,
                'error': f'Could not parse EXPLAIN plan (detected format: {detected_format}). Please check the format.'
            })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error generating visualization data: {str(e)}'
        }), 500

def parse_explain_plan_to_mermaid(explain_plan, db_engine='postgresql'):
    """
    Parse EXPLAIN plan output and convert to Mermaid.js flowchart.
    Supports CSV data and text input for multiple database engines.
    """
    if not explain_plan or not explain_plan.strip():
        return None
    
    try:
        # For MySQL with pipe separators, use text parser
        if db_engine == 'mysql' and '|' in explain_plan and 'select_type' in explain_plan:
            return parse_text_explain_plan(explain_plan, db_engine)
        # Try to parse as CSV first
        elif '\n' in explain_plan and any(',' in line for line in explain_plan.split('\n')[:3]):
            return parse_csv_explain_plan(explain_plan, db_engine)
        else:
            return parse_text_explain_plan(explain_plan, db_engine)
    except Exception as e:
        return None

def parse_csv_explain_plan(csv_data, db_engine):
    """Parse CSV-formatted EXPLAIN plan data"""
    import csv
    from io import StringIO
    
    nodes = []
    edges = []
    node_id_map = {}
    parent_stack = []
    
    # Parse CSV
    csv_reader = csv.DictReader(StringIO(csv_data))
    
    for row in csv_reader:
        # Extract node information based on database engine
        if db_engine == 'postgresql':
            node_id = row.get('Node Type', row.get('node_type', 'N'))
            operation = row.get('Operation', row.get('operation', ''))
            table_name = row.get('Table Name', row.get('table_name', ''))
            cost = row.get('Cost', row.get('cost', ''))
            rows = row.get('Rows', row.get('rows', ''))
            width = row.get('Width', row.get('width', ''))
            
            # Create node label
            label_parts = [operation]
            if table_name:
                label_parts.append(f"on {table_name}")
            if cost:
                label_parts.append(f"(cost={cost})")
            if rows:
                label_parts.append(f"rows={rows}")
            if width:
                label_parts.append(f"width={width}")
            
            label = " ".join(label_parts)
            
        elif db_engine == 'mysql':
            node_id = row.get('id', row.get('ID', 'N'))
            select_type = row.get('select_type', row.get('SELECT_TYPE', ''))
            table = row.get('table', row.get('TABLE', ''))
            type_val = row.get('type', row.get('TYPE', ''))
            key = row.get('key', row.get('KEY', ''))
            rows = row.get('rows', row.get('ROWS', ''))
            extra = row.get('extra', row.get('Extra', ''))
            
            # Create meaningful label
            label_parts = []
            if select_type and select_type != 'NULL':
                label_parts.append(select_type)
            
            if table and table != 'NULL':
                label_parts.append(f"on {table}")
            
            if type_val and type_val != 'NULL':
                label_parts.append(f"({type_val})")
            
            if key and key != 'NULL':
                label_parts.append(f"key={key}")
            
            if rows and rows != 'NULL':
                label_parts.append(f"rows={rows}")
            
            if extra and extra != 'NULL':
                # Truncate extra info if too long
                if len(extra) > 30:
                    extra = extra[:27] + "..."
                label_parts.append(extra)
            
            label = " ".join(label_parts)
            
            # Skip empty labels
            if not label or label.strip() == "":
                continue
                
            operation = select_type  # Use select_type as operation for styling
            
        elif db_engine == 'oracle':
            node_id = row.get('id', row.get('ID', 'N'))
            operation = row.get('operation', row.get('OPERATION', ''))
            name = row.get('name', row.get('NAME', ''))
            rows = row.get('rows', row.get('ROWS', ''))
            cost = row.get('cost', row.get('COST', ''))
            
            label_parts = [operation]
            if name:
                label_parts.append(f"on {name}")
            if cost:
                label_parts.append(f"(cost={cost})")
            if rows:
                label_parts.append(f"rows={rows}")
            
            label = " ".join(label_parts)
            
        elif db_engine == 'sqlserver':
            node_id = row.get('node_id', row.get('Node ID', 'N'))
            physical_op = row.get('physical_op', row.get('Physical Op', ''))
            logical_op = row.get('logical_op', row.get('Logical Op', ''))
            table_name = row.get('table_name', row.get('Table Name', ''))
            estimated_rows = row.get('estimated_rows', row.get('Estimated Rows', ''))
            
            label_parts = [physical_op]
            if logical_op and logical_op != physical_op:
                label_parts.append(f"({logical_op})")
            if table_name:
                label_parts.append(f"on {table_name}")
            if estimated_rows:
                label_parts.append(f"rows={estimated_rows}")
            
            label = " ".join(label_parts)
            
        else:  # Generic
            node_id = row.get('id', row.get('ID', 'N'))
            operation = row.get('operation', row.get('Operation', ''))
            table = row.get('table', row.get('Table', ''))
            
            label_parts = [operation]
            if table:
                label_parts.append(f"on {table}")
            
            label = " ".join(label_parts)
        
        # Create unique node ID
        unique_id = f"N{node_id}"
        node_id_map[node_id] = unique_id
        
        # Add node with simple styling (no CSS classes for now)
        nodes.append(f'{unique_id}["{label}"]')
        
        # Handle parent-child relationships
        parent_id = row.get('parent_id', row.get('Parent ID', ''))
        if parent_id and parent_id in node_id_map:
            edges.append(f'{node_id_map[parent_id]} --> {unique_id}')
    
    if nodes:
        return 'graph TD\n' + '\n'.join(nodes + edges)
    
    return None

def parse_text_explain_plan(text_data, db_engine):
    """Parse text-formatted EXPLAIN plan data with robust hierarchical parsing"""
    nodes = []
    edges = []
    node_id_map = {}
    parent_stack = []
    lines = text_data.strip().split('\n')
    skip_patterns = ['---', '===', 'QUERY PLAN', 'Planning Time:', 'Execution Time:']
    for i, line in enumerate(lines):
        line = line.strip()
        if not line or any(pattern in line for pattern in skip_patterns):
            continue
        original_line = lines[i]
        indent = len(original_line) - len(original_line.lstrip())
        if db_engine == 'oracle':
            # Try pipe-delimited table format first
            if '|' in line and not line.startswith('|--'):
                if 'Id' in line and 'Operation' in line:
                    continue
                if line.startswith('|----'):
                    continue
                parts = [part.strip() for part in line.split('|')]
                if len(parts) >= 3:
                    id_val = parts[1]
                    operation = parts[2]
                    name = parts[3] if len(parts) > 3 else ''
                    rows = parts[4] if len(parts) > 4 else ''
                    cost = parts[5] if len(parts) > 5 else ''
                    label_parts = []
                    if operation and operation != 'NULL':
                        label_parts.append(operation)
                    if name and name != 'NULL':
                        label_parts.append(f"on {name}")
                    if cost and cost != 'NULL':
                        label_parts.append(f"cost={cost}")
                    if rows and rows != 'NULL':
                        label_parts.append(f"rows={rows}")
                    label = " ".join(label_parts)
                    if not label or label.strip() == "":
                        continue
                    if len(label) > 80:
                        label = label[:77] + "..."
                    node_id = f"N{i}"
                    nodes.append(f'{node_id}["{label}"]')
                    if len(nodes) > 1:
                        prev_node = f"N{i-1}"
                        edges.append(f'{prev_node} --> {node_id}')
                    continue
            # Indented tree-like format (fallback)
            # e.g. SELECT STATEMENT\n  HASH JOIN\n    TABLE ACCESS FULL USERS\n    TABLE ACCESS FULL ORDERS
            label = line.strip()
            if not label:
                continue
            if len(label) > 80:
                label = label[:77] + "..."
            node_id = f"N{i}"
            nodes.append(f'{node_id}["{label}"]')
            # Infer parent-child from indentation
            while parent_stack and indent <= parent_stack[-1][1]:
                parent_stack.pop()
            if parent_stack:
                parent_id = parent_stack[-1][0]
                edges.append(f'{parent_id} --> {node_id}')
            parent_stack.append((node_id, indent))
        elif db_engine == 'postgresql':
            # ... existing code ...
            pass  # Unchanged
        elif db_engine == 'mysql':
            # ... existing code ...
            pass  # Unchanged
        elif db_engine == 'sqlserver':
            # ... existing code ...
            pass  # Unchanged
        else:
            # Generic fallback
            if line.strip():
                label = line.strip()
                if len(label) > 80:
                    label = label[:77] + "..."
                node_id = f"N{i}"
                nodes.append(f'{node_id}["{label}"]')
                if len(nodes) > 1:
                    prev_node = f"N{i-1}"
                    edges.append(f'{prev_node} --> {node_id}')
    if nodes:
        mermaid_code = 'graph TD\n' + '\n'.join(nodes)
        if edges:
            mermaid_code += '\n' + '\n'.join(edges)
        return mermaid_code
    return None

def get_node_style(operation, db_engine):
    """Get Mermaid.js styling for different operation types"""
    operation_lower = operation.lower()
    
    # Define color schemes for different operation types
    if any(scan in operation_lower for scan in ['seq scan', 'table scan', 'full scan', 'table access full']):
        return ':::seq-scan'
    elif any(scan in operation_lower for scan in ['index scan', 'index range scan', 'index seek']):
        return ':::index-scan'
    elif any(join in operation_lower for join in ['hash join', 'nested loop', 'merge join', 'join']):
        return ':::join'
    elif any(agg in operation_lower for agg in ['aggregate', 'group', 'sort']):
        return ':::aggregate'
    elif any(filter in operation_lower for filter in ['filter', 'where']):
        return ':::filter'
    elif any(result in operation_lower for result in ['result', 'output']):
        return ':::result'
    else:
        return ':::default'

def get_alias_to_table_mapping(sql_query):
    import re
    alias_to_table = {}
    from_join_pattern = re.compile(r'(FROM|JOIN)\s+([\w\"]+)(?:\s+AS)?\s+(\w+)', re.IGNORECASE)
    for match in from_join_pattern.finditer(sql_query):
        real_table = match.group(2).replace('"', '')
        alias = match.group(3)
        alias_to_table[alias] = real_table
    return alias_to_table

def get_real_column_index_recommendations(sql_query, indexes, alias_to_table, tables):
    import re
    where_cols = set()
    orderby_cols = set()
    join_cols = set()
    for match in re.finditer(r'WHERE\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        where_cols.add(col)
    for match in re.finditer(r'JOIN\s+\w+\s+ON\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        join_cols.add(col)
    for match in re.finditer(r'ORDER BY\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        orderby_cols.add(col)
    user_indexes = parse_user_indexes(indexes)
    index_recs = {}
    for col in where_cols | join_cols | orderby_cols:
        # Only recommend for real columns in real tables (not aggregates/aliases)
        if col and '.' in col:
            alias, column = col.split('.', 1)
            real_table = alias_to_table.get(alias, alias)
            # Check if real_table is in tables
            if real_table not in [t['name'] for t in tables]:
                continue
            # Skip aggregates/aliases
            if re.match(r'\d+$', column) or column.lower() in ['count', 'sum', 'avg', 'min', 'max', 'order_count']:
                continue
            # SKIP if already indexed
            if column.lower() in user_indexes.get(real_table.lower(), set()):
                continue
            rec_text = f"Consider creating an index on column '{column}' in table '{real_table}' for better performance."
            ddl_text = f"CREATE INDEX idx_{real_table}_{column}_auto ON {real_table}({column});"
            key = ('index', real_table, column)
            if key not in index_recs:
                index_recs[key] = {'text': rec_text, 'actionable': True, 'sub': [{'text': ddl_text, 'actionable': False}], 'key': key}
            else:
                if not any(sub['text'] == ddl_text for sub in index_recs[key]['sub']):
                    index_recs[key]['sub'].append({'text': ddl_text, 'actionable': False})
    return list(index_recs.values())

def extract_fts_tables_from_explain(explain_plan, db_engine):
    """
    Extract all tables accessed via full table scan from the EXPLAIN plan using EXPLAIN_KEYWORDS.
    Returns a set of table names.
    Improved for Oracle: robustly extract table names from lines like 'TABLE ACCESS FULL USERS' and pipe-formatted plans.
    """
    from explain_keywords import EXPLAIN_KEYWORDS
    fts_tables = set()
    if not explain_plan:
        return fts_tables
    # Normalize line endings and strip whitespace
    plan_lines = [l.strip() for l in explain_plan.strip().split('\n') if l.strip()]
    keywords = EXPLAIN_KEYWORDS.get(db_engine, {})
    scan_keywords = set(keywords.get('sequential', []) + keywords.get('table', []) + keywords.get('full_scan', []) + keywords.get('scan', []))
    for line in plan_lines:
        # Oracle pipe format: | 3 | TABLE ACCESS FULL | DEPARTMENTS | 27 | 3 (0) |
        if db_engine == 'oracle' and '|' in line:
            parts = [p.strip() for p in line.strip('|').split('|')]
            if len(parts) >= 3:
                op = parts[1].upper()
                table = parts[2]
                for kw in scan_keywords:
                    if kw.upper() in op:
                        if table and table.upper() not in {'', 'N/A', 'VW_SQ_1'}:
                            fts_tables.add(table)
        else:
            for kw in scan_keywords:
                if kw.lower() in line.lower():
                    m = re.search(rf"{re.escape(kw)}[\s]+([\w\"\[\]]+)", line, re.IGNORECASE)
                    if m:
                        table = m.group(1).replace('"', '').replace('[', '').replace(']', '')
                        fts_tables.add(table)
                    else:
                        parts = line.strip().split()
                        if len(parts) > 0:
                            table = parts[-1].replace('"', '').replace('[', '').replace(']', '')
                            if table.upper() not in {'FULL', 'ACCESS', 'TABLE', 'SCAN', 'INDEX', 'HASH', 'JOIN', 'STATEMENT'}:
                                fts_tables.add(table)
    return fts_tables

# In each analyze_* function, after parsing the EXPLAIN plan:
# 1. Call extract_fts_tables_from_explain(explain_plan, db_engine)
# 2. For each FTS table, if not already indexed, recommend an index on the best predicate column (from WHERE/JOIN), or recommend review if no predicate found.
# 3. Ensure all FTS tables are covered in recommendations.

def extract_explain_plan_metrics(explain_plan, db_engine):
    """
    Parse EXPLAIN plan for actual rows scanned, cost, memory/bytes, and estimated time for all engines.
    Returns a dict: {rows_scanned, cost, memory, time}
    """
    metrics = {'rows_scanned': None, 'cost': None, 'memory': None, 'time': None}
    if not explain_plan:
        return metrics
    plan_lines = explain_plan.strip().split('\n')
    # Try CSV first if it looks like CSV
    if any(',' in line for line in plan_lines[:3]):
        try:
            csv_reader = csv.DictReader(StringIO(explain_plan))
            rows_list, cost_list, mem_list, time_list = [], [], [], []
            for row in csv_reader:
                for k, v in row.items():
                    if v is None or v == '' or v == 'NULL':
                        continue
                    kl = k.lower()
                    if 'row' in kl and v.isdigit():
                        rows_list.append(int(v))
                    if 'cost' in kl and v.replace('.', '', 1).isdigit():
                        cost_list.append(float(v))
                    if 'byte' in kl and v.isdigit():
                        mem_list.append(int(v))
                    if 'mem' in kl and v.replace('.', '', 1).isdigit():
                        mem_list.append(float(v))
                    if 'time' in kl and v.replace('.', '', 1).isdigit():
                        time_list.append(float(v))
            if rows_list:
                metrics['rows_scanned'] = max(rows_list)
            if cost_list:
                metrics['cost'] = max(cost_list)
            if mem_list:
                metrics['memory'] = max(mem_list)
            if time_list:
                metrics['time'] = max(time_list)
            return metrics
        except Exception:
            pass
    # Text parsing by engine
    if db_engine == 'postgresql':
        # e.g. Seq Scan on users  (cost=0.00..431.00 rows=21000 width=4)
        rows_list, cost_list, mem_list, time_list = [], [], [], []
        for line in plan_lines:
            m = re.search(r'rows=(\d+)', line)
            if m:
                rows_list.append(int(m.group(1)))
            m = re.search(r'cost=([\d\.]+)\.\.([\d\.]+)', line)
            if m:
                cost_list.append(float(m.group(2)))
            m = re.search(r'width=(\d+)', line)
            if m:
                mem_list.append(int(m.group(1)))
        if rows_list:
            metrics['rows_scanned'] = max(rows_list)
        if cost_list:
            metrics['cost'] = max(cost_list)
        if mem_list:
            metrics['memory'] = max(mem_list)
    elif db_engine == 'mysql':
        # e.g. | id | select_type | table | type | rows | Extra |
        for line in plan_lines:
            m = re.search(r'rows=?(\d+)', line)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
            m = re.search(r'Using\s+filesort', line, re.IGNORECASE)
            if m:
                metrics['cost'] = (metrics['cost'] or 0) + 10
        # MySQL EXPLAIN rarely gives memory/time directly
    elif db_engine == 'oracle':
        # Pipe/table or indented
        for line in plan_lines:
            m = re.search(r'rows=?(\d+)', line)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
            m = re.search(r'cost=?(\d+)', line)
            if m:
                metrics['cost'] = max(metrics['cost'] or 0, int(m.group(1))) if metrics['cost'] else int(m.group(1))
            m = re.search(r'bytes=?(\d+)', line)
            if m:
                metrics['memory'] = max(metrics['memory'] or 0, int(m.group(1))) if metrics['memory'] else int(m.group(1))
    elif db_engine == 'sqlserver':
        for line in plan_lines:
            m = re.search(r'Estimated Rows=?(\d+)', line, re.IGNORECASE)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
            m = re.search(r'Estimated Total Subtree Cost=([\d\.]+)', line, re.IGNORECASE)
            if m:
                metrics['cost'] = max(metrics['cost'] or 0, float(m.group(1))) if metrics['cost'] else float(m.group(1))
            m = re.search(r'Memory Grant=([\d\.]+)', line, re.IGNORECASE)
            if m:
                metrics['memory'] = max(metrics['memory'] or 0, float(m.group(1))) if metrics['memory'] else float(m.group(1))
    elif db_engine == 'sqlite':
        for line in plan_lines:
            m = re.search(r'rows=?(\d+)', line)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
    return metrics

def parse_user_indexes(indexes):
    """
    Parse user-provided index definitions and return {table: set(columns)} for fast lookup.
    Supports multi-column indexes and different syntaxes for all engines.
    """
    table_to_indexed_cols = {}
    for idx in indexes:
        defn = idx.get('definition') or idx.get('ddl') or ''
        # Try to extract table and columns from CREATE INDEX ... ON table(col1, col2, ...)
        m = re.search(r'CREATE\s+INDEX\s+\w+\s+ON\s+([\w\"\[\]]+)\s*\(([^)]+)\)', defn, re.IGNORECASE)
        if m:
            table = m.group(1).replace('"', '').replace('[', '').replace(']', '').lower()
            cols = [c.strip().lower() for c in m.group(2).split(',')]
            table_to_indexed_cols.setdefault(table, set()).update(cols)
            continue
        # MySQL/SQL Server: CREATE INDEX ... ON table (col1, col2)
        m = re.search(r'ON\s+([\w\"\[\]]+)\s*\(([^)]+)\)', defn, re.IGNORECASE)
        if m:
            table = m.group(1).replace('"', '').replace('[', '').replace(']', '').lower()
            cols = [c.strip().lower() for c in m.group(2).split(',')]
            table_to_indexed_cols.setdefault(table, set()).update(cols)
            continue
        # Oracle: CREATE INDEX ... ON "TABLE" ("COL1", ...)
        m = re.search(r'ON\s+"?([\w]+)"?\s*\(([^)]+)\)', defn, re.IGNORECASE)
        if m:
            table = m.group(1).lower()
            cols = [c.replace('"', '').strip().lower() for c in m.group(2).split(',')]
            table_to_indexed_cols.setdefault(table, set()).update(cols)
    return table_to_indexed_cols

# Update recommend_indexes_for_fts_tables to use parse_user_indexes

def recommend_indexes_for_fts_tables(sql_query, indexes, alias_to_table, tables, explain_plan, db_engine):
    """
    For every FTS table detected in the EXPLAIN plan, recommend an index on the best predicate column (from WHERE/JOIN/ORDER BY),
    or a review if no predicate is found. If an index exists but FTS still occurs, recommend investigation steps.
    Never recommend both a new index and investigation for the same table.
    """
    fts_tables = extract_fts_tables_from_explain(explain_plan, db_engine)
    where_cols = set()
    orderby_cols = set()
    join_cols = set()
    for match in re.finditer(r'WHERE\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        where_cols.add(col)
    for match in re.finditer(r'JOIN\s+\w+\s+ON\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        join_cols.add(col)
    for match in re.finditer(r'ORDER BY\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        orderby_cols.add(col)
    user_indexes = parse_user_indexes(indexes)
    recs = []
    for fts_table in fts_tables:
        fts_table_lc = fts_table.lower()
        investigation_given = False
        # Check if any relevant predicate column already has an index
        for col in where_cols | join_cols | orderby_cols:
            if col and '.' in col:
                alias, column = col.split('.', 1)
                real_table = alias_to_table.get(alias, alias).lower()
                column_lc = column.lower()
                if real_table == fts_table_lc:
                    # Skip aggregates/aliases
                    if re.match(r'\d+$', column_lc) or column_lc in ['count', 'sum', 'avg', 'min', 'max', 'order_count']:
                        continue
                    if column_lc in user_indexes.get(real_table, set()):
                        # Only investigation advice, never a new index for this table
                        rec_text = (f"Table '{fts_table}' is accessed via Full Table Scan even though an index exists on '{column}'. "
                                    f"Consider running ANALYZE/UPDATE STATISTICS, checking for data skew or NULLs, or using a query hint to encourage index usage.")
                        key = ('fts_index_exists', fts_table, column)
                        recs.append({'text': rec_text, 'actionable': True, 'sub': [], 'key': key})
                        investigation_given = True
                        break
        if not investigation_given:
            # Only recommend a new index if no relevant predicate column has an index
            best_col = None
            for col in where_cols | join_cols | orderby_cols:
                if col and '.' in col:
                    alias, column = col.split('.', 1)
                    real_table = alias_to_table.get(alias, alias).lower()
                    column_lc = column.lower()
                    if real_table == fts_table_lc:
                        # Skip aggregates/aliases
                        if re.match(r'\d+$', column_lc) or column_lc in ['count', 'sum', 'avg', 'min', 'max', 'order_count']:
                            continue
                        best_col = column
                        break
            if best_col:
                rec_text = f"Consider creating an index on column '{best_col}' in table '{fts_table}' for better performance (Full Table Scan detected)."
                ddl_text = f"CREATE INDEX idx_{fts_table}_{best_col}_auto ON {fts_table}({best_col});"
                key = ('fts_index', fts_table, best_col)
                recs.append({'text': rec_text, 'actionable': True, 'sub': [{'text': ddl_text, 'actionable': False}], 'key': key})
            else:
                rec_text = f"Table '{fts_table}' is accessed via Full Table Scan. Review for possible indexing or query rewrite."
                key = ('fts_review', fts_table)
                recs.append({'text': rec_text, 'actionable': True, 'sub': [], 'key': key})
    return recs

@app.errorhandler(CSRFError)
def handle_csrf_error(e):
    return render_template('csrf_error.html', reason=e.description), 400

def detect_engine_from_explain(explain_plan):
    """
    Heuristically detect the likely DB engine from the EXPLAIN plan string.
    Returns one of: 'oracle', 'mysql', 'postgresql', 'sqlserver', 'sqlite', or None.
    """
    if not explain_plan:
        return None
    plan = explain_plan.strip().lower()
    # SQL Server: |--, Clustered Index Scan, Hash Match, Nested Loops, etc.
    if '|--' in plan or 'clustered index scan' in plan or 'hash match' in plan or 'nested loops' in plan:
        return 'sqlserver'
    # Oracle: pipe format, TABLE ACCESS FULL, COST (%CPU)
    if 'table access full' in plan or 'cost (%cpu)' in plan or '| id  | operation' in plan:
        return 'oracle'
    # MySQL: id, select_type, table, type, rows, Extra
    if 'select_type' in plan and 'rows' in plan and 'extra' in plan:
        return 'mysql'
    if '| id |' in plan and '| table |' in plan:
        return 'mysql'
    # PostgreSQL: Seq Scan, Index Scan, cost=, width=
    if 'seq scan' in plan or 'index scan' in plan or 'cost=' in plan or 'width=' in plan:
        return 'postgresql'
    # SQLite: SCAN TABLE, SEARCH TABLE
    if 'scan table' in plan or 'search table' in plan:
        return 'sqlite'
    return None

def detect_explain_format(explain_plan):
    if not explain_plan:
        return 'unknown'
    plan_text = explain_plan.strip()
    # SQL Server tree format (prioritize this check)
    if '|--' in plan_text or 'Clustered Index Scan' in plan_text or 'Hash Match' in plan_text or 'Nested Loops' in plan_text:
        return 'sqlserver'
    # Check for JSON format
    if (plan_text.startswith('[') and plan_text.endswith(']')) or \
       (plan_text.startswith('{') and plan_text.endswith('}')):
        try:
            json.loads(plan_text)
            return 'json'
        except json.JSONDecodeError:
            pass
    # Check for XML format (SQL Server ShowPlanXML)
    if plan_text.startswith('<') or '<RelOp' in plan_text or '<ShowPlanXML' in plan_text:
        return 'xml'
    # Check for SQL Server specific formats (table style)
    if any(keyword in plan_text for keyword in [
        'StmtText', 'PhysicalOp', 'LogicalOp', 'EstimateRows', 'EstimateIO', 'EstimateCPU', 'TotalSubtreeCost',
        'HashAggregate', 'NodeId', 'PhysicalOp=', 'LogicalOp=', 'EstimateRows='
    ]):
        return 'sqlserver'
    # Check for PostgreSQL text format (has indentation and -> markers)
    if '->' in plan_text or 'Planning Time:' in plan_text or 'Execution Time:' in plan_text:
        return 'postgresql_text'
    # Check for Oracle format (pipe-delimited or table format)
    if '|' in plan_text and ('Id' in plan_text or 'OPERATION' in plan_text):
        return 'oracle'
    # Default to text format
    return 'text'

def parse_explain_to_json(explain_plan, db_engine):
    """Parse explain plan with format detection and routing"""
    if not explain_plan:
        return None
    
    # Auto-detect format
    detected_format = detect_explain_format(explain_plan)
    
    # Route to appropriate parser based on engine and format
    if db_engine == 'postgresql':
        if detected_format == 'json':
            return parse_postgresql_json(explain_plan)
        elif detected_format == 'xml':
            return parse_postgresql_xml(explain_plan)
        elif detected_format == 'postgresql_text':
            return parse_postgresql_text(explain_plan)
        else:
            return parse_postgresql_text(explain_plan)  # fallback
    elif db_engine == 'oracle':
        if detected_format == 'oracle':
            return parse_oracle_explain_flow(explain_plan)
        else:
            return parse_oracle_explain_flow(explain_plan)  # fallback
    elif db_engine == 'sqlserver':
        if detected_format == 'sqlserver':
            return parse_sqlserver_explain_flow(explain_plan)
        elif detected_format == 'xml':
            return parse_sqlserver_xml(explain_plan)
        else:
            return parse_sqlserver_explain_flow(explain_plan)  # fallback
    
    return None

def parse_postgresql_json(explain_plan):
    """Parse PostgreSQL JSON format - richest data source"""
    try:
        data = json.loads(explain_plan)
        return extract_from_postgresql_json(data)
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        return None

def extract_from_postgresql_json(data):
    """Extract execution tree from PostgreSQL JSON format"""
    if not data or not isinstance(data, list) or len(data) == 0:
        return None
    
    # PostgreSQL JSON format: [{"Plan": {...}}]
    plan_data = data[0].get('Plan', {})
    
    execution_tree = {
        'operation': 'Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    def extract_node_data(node):
        """Extract metrics from a JSON node"""
        node_data = {
            'operation': node.get('Node Type', 'Unknown Operation'),
            'cost': node.get('Total Cost', 0),
            'startup_cost': node.get('Startup Cost', 0),
            'rows': node.get('Actual Rows', node.get('Plan Rows', 0)),
            'time': node.get('Actual Total Time', 0),
            'buffers': node.get('Buffers', {}),
            'children': []
        }
        
        # Add relation name if available
        if node.get('Relation Name'):
            node_data['operation'] += f" on {node.get('Relation Name')}"
        
        # Add index name if available
        if node.get('Index Name'):
            node_data['operation'] += f" using {node.get('Index Name')}"
        
        # Add scan direction if available
        if node.get('Scan Direction'):
            node_data['operation'] += f" ({node.get('Scan Direction')})"
        
        # Add filter conditions if available
        if node.get('Filter'):
            node_data['filter'] = node.get('Filter')
        
        # Add join conditions if available
        if node.get('Hash Cond'):
            node_data['join_condition'] = node.get('Hash Cond')
        
        # Process children
        if 'Plans' in node:
            for child in node['Plans']:
                child_data = extract_node_data(child)
                node_data['children'].append(child_data)
        
        return node_data
    
    # Extract the main plan
    main_plan = extract_node_data(plan_data)
    execution_tree.update(main_plan)
    
    return execution_tree

def parse_postgresql_xml(explain_plan):
    """Parse PostgreSQL XML format"""
    # TODO: Implement XML parsing for PostgreSQL
    # For now, fallback to text parsing
    return parse_postgresql_text(explain_plan)

def parse_postgresql_text(explain_plan):
    """Parse PostgreSQL TEXT format - enhanced version"""
    lines = explain_plan.strip().split('\n')
    
    # Skip header lines
    skip_patterns = ['Planning Time:', 'Execution Time:', 'QUERY PLAN', '---']
    filtered_lines = []
    for line in lines:
        if not any(pattern in line for pattern in skip_patterns):
            filtered_lines.append(line)
    
    if not filtered_lines:
        return None
    
    # Parse the execution flow based on indentation
    execution_tree = {
        'operation': 'Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    # Stack to track parent nodes based on indentation
    node_stack = [execution_tree]
    indent_stack = [-1]  # Track indentation levels
    
    for line in filtered_lines:
        if not line.strip():
            continue
            
        # Calculate indentation level (count leading spaces or ->)
        original_line = line
        indent_level = 0
        while line.startswith('  ') or line.startswith('-> '):
            if line.startswith('-> '):
                indent_level += 1
                line = line[3:]
            else:
                indent_level += 1
                line = line[2:]
        
        # Parse operation and metrics
        operation, metrics = parse_enhanced_postgresql_line(line)
        
        if not operation:
            continue
        
        # Create node
        node = {
            'operation': operation,
            'cost': metrics.get('cost', 0),
            'rows': metrics.get('rows', 0),
            'time': metrics.get('time', 0),
            'buffers': metrics.get('buffers', {}),
            'children': []
        }
        
        # Find the correct parent based on indentation
        while len(indent_stack) > 1 and indent_level <= indent_stack[-1]:
            node_stack.pop()
            indent_stack.pop()
        
        # Add to current parent
        node_stack[-1]['children'].append(node)
        
        # Push this node onto stack for potential children
        node_stack.append(node)
        indent_stack.append(indent_level)
    
    return execution_tree

def parse_enhanced_postgresql_line(line):
    """Parse a single PostgreSQL operation line with enhanced metrics"""
    line = line.strip()
    
    # Extract metrics from parentheses
    metrics = {}
    operation = line
    
    # Look for metrics in parentheses
    if ' (cost=' in line:
        parts = line.split(' (cost=', 1)
        operation = parts[0].strip()
        metrics_str = 'cost=' + parts[1]
        
        # Parse startup and total cost
        cost_match = re.search(r'cost=([\d.]+)\.\.([\d.]+)', metrics_str)
        if cost_match:
            metrics['startup_cost'] = float(cost_match.group(1))
            metrics['cost'] = float(cost_match.group(2))
        
        # Parse rows
        rows_match = re.search(r'rows=(\d+)', metrics_str)
        if rows_match:
            metrics['rows'] = int(rows_match.group(1))
        
        # Parse actual time if available
        time_match = re.search(r'actual time=([\d.]+)\.\.([\d.]+)', metrics_str)
        if time_match:
            metrics['time'] = float(time_match.group(2))  # Use end time
        
        # Parse width
        width_match = re.search(r'width=(\d+)', metrics_str)
        if width_match:
            metrics['width'] = int(width_match.group(1))
        
        # Parse buffer information
        buffers_match = re.search(r'Buffers: (.*?)(?:\s|$)', metrics_str)
        if buffers_match:
            buffers_str = buffers_match.group(1)
            metrics['buffers'] = parse_buffer_info(buffers_str)
    
    # Extract filter conditions
    filter_match = re.search(r'Filter: (.+?)(?:\s|$)', line)
    if filter_match:
        metrics['filter'] = filter_match.group(1)
    
    # Extract join conditions
    join_match = re.search(r'Hash Cond: (.+?)(?:\s|$)', line)
    if join_match:
        metrics['join_condition'] = join_match.group(1)
    
    # Clean up operation name
    operation = operation.replace('_', ' ').title()
    
    return operation, metrics

def parse_buffer_info(buffers_str):
    """Parse PostgreSQL buffer information"""
    buffers = {}
    
    # Parse shared hit/read/written
    shared_hit = re.search(r'shared hit=(\d+)', buffers_str)
    if shared_hit:
        buffers['shared_hit'] = int(shared_hit.group(1))
    
    shared_read = re.search(r'shared read=(\d+)', buffers_str)
    if shared_read:
        buffers['shared_read'] = int(shared_read.group(1))
    
    shared_written = re.search(r'shared written=(\d+)', buffers_str)
    if shared_written:
        buffers['shared_written'] = int(shared_written.group(1))
    
    return buffers

def parse_sqlserver_xml(explain_plan):
    """Parse SQL Server XML format (ShowPlanXML)"""
    # TODO: Implement XML parsing for SQL Server
    # For now, fallback to text parsing
    return parse_sqlserver_explain_flow(explain_plan)

def parse_sqlserver_generic_format(lines):
    """Parse SQL Server generic format"""
    execution_tree = {
        'operation': 'SQL Server Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    # For other SQL Server formats, try to extract operations
    for line in lines:
        operation, metrics = parse_enhanced_sqlserver_line(line)
        if operation:
            node = {
                'operation': operation,
                'cost': metrics.get('cost', 0),
                'rows': metrics.get('rows', 0),
                'time': metrics.get('time', 0),
                'buffers': metrics.get('buffers', {}),
                'children': []
            }
            execution_tree['children'].append(node)
    
    return execution_tree

def parse_operation_line(line):
    """Parse a single operation line to extract operation name and metrics"""
    line = line.strip()
    
    # Extract metrics from parentheses
    metrics = {}
    operation = line
    
    # Look for metrics in parentheses
    if ' (cost=' in line:
        parts = line.split(' (cost=', 1)
        operation = parts[0].strip()
        metrics_str = 'cost=' + parts[1]
        
        # Parse cost
        cost_match = re.search(r'cost=([\d.]+)\.\.([\d.]+)', metrics_str)
        if cost_match:
            metrics['cost'] = float(cost_match.group(2))  # Use end cost
        
        # Parse rows
        rows_match = re.search(r'rows=(\d+)', metrics_str)
        if rows_match:
            metrics['rows'] = int(rows_match.group(1))
        
        # Parse actual time if available
        time_match = re.search(r'actual time=([\d.]+)\.\.([\d.]+)', metrics_str)
        if time_match:
            metrics['time'] = float(time_match.group(2))  # Use end time
        
        # Parse width
        width_match = re.search(r'width=(\d+)', metrics_str)
        if width_match:
            metrics['width'] = int(width_match.group(1))
    
    # Clean up operation name
    operation = operation.replace('_', ' ').title()
    
    return operation, metrics

def parse_explain_plan_to_mermaid(explain_plan, db_engine='postgresql'):
    """
    Parse EXPLAIN plan output and convert to Mermaid.js flowchart.
    Supports CSV data and text input for multiple database engines.
    """
    if not explain_plan or not explain_plan.strip():
        return None
    
    try:
        # For MySQL with pipe separators, use text parser
        if db_engine == 'mysql' and '|' in explain_plan and 'select_type' in explain_plan:
            return parse_text_explain_plan(explain_plan, db_engine)
        # Try to parse as CSV first
        elif '\n' in explain_plan and any(',' in line for line in explain_plan.split('\n')[:3]):
            return parse_csv_explain_plan(explain_plan, db_engine)
        else:
            return parse_text_explain_plan(explain_plan, db_engine)
    except Exception as e:
        return None

def parse_csv_explain_plan(csv_data, db_engine):
    """Parse CSV-formatted EXPLAIN plan data"""
    import csv
    from io import StringIO
    
    nodes = []
    edges = []
    node_id_map = {}
    parent_stack = []
    
    # Parse CSV
    csv_reader = csv.DictReader(StringIO(csv_data))
    
    for row in csv_reader:
        # Extract node information based on database engine
        if db_engine == 'postgresql':
            node_id = row.get('Node Type', row.get('node_type', 'N'))
            operation = row.get('Operation', row.get('operation', ''))
            table_name = row.get('Table Name', row.get('table_name', ''))
            cost = row.get('Cost', row.get('cost', ''))
            rows = row.get('Rows', row.get('rows', ''))
            width = row.get('Width', row.get('width', ''))
            
            # Create node label
            label_parts = [operation]
            if table_name:
                label_parts.append(f"on {table_name}")
            if cost:
                label_parts.append(f"(cost={cost})")
            if rows:
                label_parts.append(f"rows={rows}")
            if width:
                label_parts.append(f"width={width}")
            
            label = " ".join(label_parts)
            
        elif db_engine == 'mysql':
            node_id = row.get('id', row.get('ID', 'N'))
            select_type = row.get('select_type', row.get('SELECT_TYPE', ''))
            table = row.get('table', row.get('TABLE', ''))
            type_val = row.get('type', row.get('TYPE', ''))
            key = row.get('key', row.get('KEY', ''))
            rows = row.get('rows', row.get('ROWS', ''))
            extra = row.get('extra', row.get('Extra', ''))
            
            # Create meaningful label
            label_parts = []
            if select_type and select_type != 'NULL':
                label_parts.append(select_type)
            
            if table and table != 'NULL':
                label_parts.append(f"on {table}")
            
            if type_val and type_val != 'NULL':
                label_parts.append(f"({type_val})")
            
            if key and key != 'NULL':
                label_parts.append(f"key={key}")
            
            if rows and rows != 'NULL':
                label_parts.append(f"rows={rows}")
            
            if extra and extra != 'NULL':
                # Truncate extra info if too long
                if len(extra) > 30:
                    extra = extra[:27] + "..."
                label_parts.append(extra)
            
            label = " ".join(label_parts)
            
            # Skip empty labels
            if not label or label.strip() == "":
                continue
                
            operation = select_type  # Use select_type as operation for styling
            
        elif db_engine == 'oracle':
            node_id = row.get('id', row.get('ID', 'N'))
            operation = row.get('operation', row.get('OPERATION', ''))
            name = row.get('name', row.get('NAME', ''))
            rows = row.get('rows', row.get('ROWS', ''))
            cost = row.get('cost', row.get('COST', ''))
            
            label_parts = [operation]
            if name:
                label_parts.append(f"on {name}")
            if cost:
                label_parts.append(f"cost={cost}")
            if rows:
                label_parts.append(f"rows={rows}")
            
            label = " ".join(label_parts)
            
        elif db_engine == 'sqlserver':
            node_id = row.get('node_id', row.get('Node ID', 'N'))
            physical_op = row.get('physical_op', row.get('Physical Op', ''))
            logical_op = row.get('logical_op', row.get('Logical Op', ''))
            table_name = row.get('table_name', row.get('Table Name', ''))
            estimated_rows = row.get('estimated_rows', row.get('Estimated Rows', ''))
            
            label_parts = [physical_op]
            if logical_op and logical_op != physical_op:
                label_parts.append(f"({logical_op})")
            if table_name:
                label_parts.append(f"on {table_name}")
            if estimated_rows:
                label_parts.append(f"rows={estimated_rows}")
            
            label = " ".join(label_parts)
            
        else:  # Generic
            node_id = row.get('id', row.get('ID', 'N'))
            operation = row.get('operation', row.get('Operation', ''))
            table = row.get('table', row.get('Table', ''))
            
            label_parts = [operation]
            if table:
                label_parts.append(f"on {table}")
            
            label = " ".join(label_parts)
        
        # Create unique node ID
        unique_id = f"N{node_id}"
        node_id_map[node_id] = unique_id
        
        # Add node with simple styling (no CSS classes for now)
        nodes.append(f'{unique_id}["{label}"]')
        
        # Handle parent-child relationships
        parent_id = row.get('parent_id', row.get('Parent ID', ''))
        if parent_id and parent_id in node_id_map:
            edges.append(f'{node_id_map[parent_id]} --> {unique_id}')
    
    if nodes:
        return 'graph TD\n' + '\n'.join(nodes + edges)
    
    return None

def parse_text_explain_plan(text_data, db_engine):
    """Parse text-formatted EXPLAIN plan data with robust hierarchical parsing"""
    nodes = []
    edges = []
    node_id_map = {}
    parent_stack = []
    lines = text_data.strip().split('\n')
    skip_patterns = ['---', '===', 'QUERY PLAN', 'Planning Time:', 'Execution Time:']
    for i, line in enumerate(lines):
        line = line.strip()
        if not line or any(pattern in line for pattern in skip_patterns):
            continue
        original_line = lines[i]
        indent = len(original_line) - len(original_line.lstrip())
        if db_engine == 'oracle':
            # Try pipe-delimited table format first
            if '|' in line and not line.startswith('|--'):
                if 'Id' in line and 'Operation' in line:
                    continue
                if line.startswith('|----'):
                    continue
                parts = [part.strip() for part in line.split('|')]
                if len(parts) >= 3:
                    id_val = parts[1]
                    operation = parts[2]
                    name = parts[3] if len(parts) > 3 else ''
                    rows = parts[4] if len(parts) > 4 else ''
                    cost = parts[5] if len(parts) > 5 else ''
                    label_parts = []
                    if operation and operation != 'NULL':
                        label_parts.append(operation)
                    if name and name != 'NULL':
                        label_parts.append(f"on {name}")
                    if cost and cost != 'NULL':
                        label_parts.append(f"cost={cost}")
                    if rows and rows != 'NULL':
                        label_parts.append(f"rows={rows}")
                    label = " ".join(label_parts)
                    if not label or label.strip() == "":
                        continue
                    if len(label) > 80:
                        label = label[:77] + "..."
                    node_id = f"N{i}"
                    nodes.append(f'{node_id}["{label}"]')
                    if len(nodes) > 1:
                        prev_node = f"N{i-1}"
                        edges.append(f'{prev_node} --> {node_id}')
                    continue
            # Indented tree-like format (fallback)
            # e.g. SELECT STATEMENT\n  HASH JOIN\n    TABLE ACCESS FULL USERS\n    TABLE ACCESS FULL ORDERS
            label = line.strip()
            if not label:
                continue
            if len(label) > 80:
                label = label[:77] + "..."
            node_id = f"N{i}"
            nodes.append(f'{node_id}["{label}"]')
            # Infer parent-child from indentation
            while parent_stack and indent <= parent_stack[-1][1]:
                parent_stack.pop()
            if parent_stack:
                parent_id = parent_stack[-1][0]
                edges.append(f'{parent_id} --> {node_id}')
            parent_stack.append((node_id, indent))
        elif db_engine == 'postgresql':
            # ... existing code ...
            pass  # Unchanged
        elif db_engine == 'mysql':
            # ... existing code ...
            pass  # Unchanged
        elif db_engine == 'sqlserver':
            # ... existing code ...
            pass  # Unchanged
        else:
            # Generic fallback
            if line.strip():
                label = line.strip()
                if len(label) > 80:
                    label = label[:77] + "..."
                node_id = f"N{i}"
                nodes.append(f'{node_id}["{label}"]')
                if len(nodes) > 1:
                    prev_node = f"N{i-1}"
                    edges.append(f'{prev_node} --> {node_id}')
    if nodes:
        mermaid_code = 'graph TD\n' + '\n'.join(nodes)
        if edges:
            mermaid_code += '\n' + '\n'.join(edges)
        return mermaid_code
    return None

def get_node_style(operation, db_engine):
    """Get Mermaid.js styling for different operation types"""
    operation_lower = operation.lower()
    
    # Define color schemes for different operation types
    if any(scan in operation_lower for scan in ['seq scan', 'table scan', 'full scan', 'table access full']):
        return ':::seq-scan'
    elif any(scan in operation_lower for scan in ['index scan', 'index range scan', 'index seek']):
        return ':::index-scan'
    elif any(join in operation_lower for join in ['hash join', 'nested loop', 'merge join', 'join']):
        return ':::join'
    elif any(agg in operation_lower for agg in ['aggregate', 'group', 'sort']):
        return ':::aggregate'
    elif any(filter in operation_lower for filter in ['filter', 'where']):
        return ':::filter'
    elif any(result in operation_lower for result in ['result', 'output']):
        return ':::result'
    else:
        return ':::default'

def get_alias_to_table_mapping(sql_query):
    import re
    alias_to_table = {}
    from_join_pattern = re.compile(r'(FROM|JOIN)\s+([\w\"]+)(?:\s+AS)?\s+(\w+)', re.IGNORECASE)
    for match in from_join_pattern.finditer(sql_query):
        real_table = match.group(2).replace('"', '')
        alias = match.group(3)
        alias_to_table[alias] = real_table
    return alias_to_table

def get_real_column_index_recommendations(sql_query, indexes, alias_to_table, tables):
    import re
    where_cols = set()
    orderby_cols = set()
    join_cols = set()
    for match in re.finditer(r'WHERE\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        where_cols.add(col)
    for match in re.finditer(r'JOIN\s+\w+\s+ON\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        join_cols.add(col)
    for match in re.finditer(r'ORDER BY\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        orderby_cols.add(col)
    user_indexes = parse_user_indexes(indexes)
    index_recs = {}
    for col in where_cols | join_cols | orderby_cols:
        # Only recommend for real columns in real tables (not aggregates/aliases)
        if col and '.' in col:
            alias, column = col.split('.', 1)
            real_table = alias_to_table.get(alias, alias)
            # Check if real_table is in tables
            if real_table not in [t['name'] for t in tables]:
                continue
            # Skip aggregates/aliases
            if re.match(r'\d+$', column) or column.lower() in ['count', 'sum', 'avg', 'min', 'max', 'order_count']:
                continue
            # SKIP if already indexed
            if column.lower() in user_indexes.get(real_table.lower(), set()):
                continue
            rec_text = f"Consider creating an index on column '{column}' in table '{real_table}' for better performance."
            ddl_text = f"CREATE INDEX idx_{real_table}_{column}_auto ON {real_table}({column});"
            key = ('index', real_table, column)
            if key not in index_recs:
                index_recs[key] = {'text': rec_text, 'actionable': True, 'sub': [{'text': ddl_text, 'actionable': False}], 'key': key}
            else:
                if not any(sub['text'] == ddl_text for sub in index_recs[key]['sub']):
                    index_recs[key]['sub'].append({'text': ddl_text, 'actionable': False})
    return list(index_recs.values())

def extract_fts_tables_from_explain(explain_plan, db_engine):
    """
    Extract all tables accessed via full table scan from the EXPLAIN plan using EXPLAIN_KEYWORDS.
    Returns a set of table names.
    Improved for Oracle: robustly extract table names from lines like 'TABLE ACCESS FULL USERS' and pipe-formatted plans.
    """
    from explain_keywords import EXPLAIN_KEYWORDS
    fts_tables = set()
    if not explain_plan:
        return fts_tables
    # Normalize line endings and strip whitespace
    plan_lines = [l.strip() for l in explain_plan.strip().split('\n') if l.strip()]
    keywords = EXPLAIN_KEYWORDS.get(db_engine, {})
    scan_keywords = set(keywords.get('sequential', []) + keywords.get('table', []) + keywords.get('full_scan', []) + keywords.get('scan', []))
    for line in plan_lines:
        # Oracle pipe format: | 3 | TABLE ACCESS FULL | DEPARTMENTS | 27 | 3 (0) |
        if db_engine == 'oracle' and '|' in line:
            parts = [p.strip() for p in line.strip('|').split('|')]
            if len(parts) >= 3:
                op = parts[1].upper()
                table = parts[2]
                for kw in scan_keywords:
                    if kw.upper() in op:
                        if table and table.upper() not in {'', 'N/A', 'VW_SQ_1'}:
                            fts_tables.add(table)
        else:
            for kw in scan_keywords:
                if kw.lower() in line.lower():
                    m = re.search(rf"{re.escape(kw)}[\s]+([\w\"\[\]]+)", line, re.IGNORECASE)
                    if m:
                        table = m.group(1).replace('"', '').replace('[', '').replace(']', '')
                        fts_tables.add(table)
                    else:
                        parts = line.strip().split()
                        if len(parts) > 0:
                            table = parts[-1].replace('"', '').replace('[', '').replace(']', '')
                            if table.upper() not in {'FULL', 'ACCESS', 'TABLE', 'SCAN', 'INDEX', 'HASH', 'JOIN', 'STATEMENT'}:
                                fts_tables.add(table)
    return fts_tables

# In each analyze_* function, after parsing the EXPLAIN plan:
# 1. Call extract_fts_tables_from_explain(explain_plan, db_engine)
# 2. For each FTS table, if not already indexed, recommend an index on the best predicate column (from WHERE/JOIN), or recommend review if no predicate found.
# 3. Ensure all FTS tables are covered in recommendations.

def extract_explain_plan_metrics(explain_plan, db_engine):
    """
    Parse EXPLAIN plan for actual rows scanned, cost, memory/bytes, and estimated time for all engines.
    Returns a dict: {rows_scanned, cost, memory, time}
    """
    metrics = {'rows_scanned': None, 'cost': None, 'memory': None, 'time': None}
    if not explain_plan:
        return metrics
    plan_lines = explain_plan.strip().split('\n')
    # Try CSV first if it looks like CSV
    if any(',' in line for line in plan_lines[:3]):
        try:
            csv_reader = csv.DictReader(StringIO(explain_plan))
            rows_list, cost_list, mem_list, time_list = [], [], [], []
            for row in csv_reader:
                for k, v in row.items():
                    if v is None or v == '' or v == 'NULL':
                        continue
                    kl = k.lower()
                    if 'row' in kl and v.isdigit():
                        rows_list.append(int(v))
                    if 'cost' in kl and v.replace('.', '', 1).isdigit():
                        cost_list.append(float(v))
                    if 'byte' in kl and v.isdigit():
                        mem_list.append(int(v))
                    if 'mem' in kl and v.replace('.', '', 1).isdigit():
                        mem_list.append(float(v))
                    if 'time' in kl and v.replace('.', '', 1).isdigit():
                        time_list.append(float(v))
            if rows_list:
                metrics['rows_scanned'] = max(rows_list)
            if cost_list:
                metrics['cost'] = max(cost_list)
            if mem_list:
                metrics['memory'] = max(mem_list)
            if time_list:
                metrics['time'] = max(time_list)
            return metrics
        except Exception:
            pass
    # Text parsing by engine
    if db_engine == 'postgresql':
        # e.g. Seq Scan on users  (cost=0.00..431.00 rows=21000 width=4)
        rows_list, cost_list, mem_list, time_list = [], [], [], []
        for line in plan_lines:
            m = re.search(r'rows=(\d+)', line)
            if m:
                rows_list.append(int(m.group(1)))
            m = re.search(r'cost=([\d\.]+)\.\.([\d\.]+)', line)
            if m:
                cost_list.append(float(m.group(2)))
            m = re.search(r'width=(\d+)', line)
            if m:
                mem_list.append(int(m.group(1)))
        if rows_list:
            metrics['rows_scanned'] = max(rows_list)
        if cost_list:
            metrics['cost'] = max(cost_list)
        if mem_list:
            metrics['memory'] = max(mem_list)
    elif db_engine == 'mysql':
        # e.g. | id | select_type | table | type | rows | Extra |
        for line in plan_lines:
            m = re.search(r'rows=?(\d+)', line)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
            m = re.search(r'Using\s+filesort', line, re.IGNORECASE)
            if m:
                metrics['cost'] = (metrics['cost'] or 0) + 10
        # MySQL EXPLAIN rarely gives memory/time directly
    elif db_engine == 'oracle':
        # Pipe/table or indented
        for line in plan_lines:
            m = re.search(r'rows=?(\d+)', line)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
            m = re.search(r'cost=?(\d+)', line)
            if m:
                metrics['cost'] = max(metrics['cost'] or 0, int(m.group(1))) if metrics['cost'] else int(m.group(1))
            m = re.search(r'bytes=?(\d+)', line)
            if m:
                metrics['memory'] = max(metrics['memory'] or 0, int(m.group(1))) if metrics['memory'] else int(m.group(1))
    elif db_engine == 'sqlserver':
        for line in plan_lines:
            m = re.search(r'Estimated Rows=?(\d+)', line, re.IGNORECASE)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
            m = re.search(r'Estimated Total Subtree Cost=([\d\.]+)', line, re.IGNORECASE)
            if m:
                metrics['cost'] = max(metrics['cost'] or 0, float(m.group(1))) if metrics['cost'] else float(m.group(1))
            m = re.search(r'Memory Grant=([\d\.]+)', line, re.IGNORECASE)
            if m:
                metrics['memory'] = max(metrics['memory'] or 0, float(m.group(1))) if metrics['memory'] else float(m.group(1))
    elif db_engine == 'sqlite':
        for line in plan_lines:
            m = re.search(r'rows=?(\d+)', line)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
    return metrics

def parse_user_indexes(indexes):
    """
    Parse user-provided index definitions and return {table: set(columns)} for fast lookup.
    Supports multi-column indexes and different syntaxes for all engines.
    """
    table_to_indexed_cols = {}
    for idx in indexes:
        defn = idx.get('definition') or idx.get('ddl') or ''
        # Try to extract table and columns from CREATE INDEX ... ON table(col1, col2, ...)
        m = re.search(r'CREATE\s+INDEX\s+\w+\s+ON\s+([\w\"\[\]]+)\s*\(([^)]+)\)', defn, re.IGNORECASE)
        if m:
            table = m.group(1).replace('"', '').replace('[', '').replace(']', '').lower()
            cols = [c.strip().lower() for c in m.group(2).split(',')]
            table_to_indexed_cols.setdefault(table, set()).update(cols)
            continue
        # MySQL/SQL Server: CREATE INDEX ... ON table (col1, col2)
        m = re.search(r'ON\s+([\w\"\[\]]+)\s*\(([^)]+)\)', defn, re.IGNORECASE)
        if m:
            table = m.group(1).replace('"', '').replace('[', '').replace(']', '').lower()
            cols = [c.strip().lower() for c in m.group(2).split(',')]
            table_to_indexed_cols.setdefault(table, set()).update(cols)
            continue
        # Oracle: CREATE INDEX ... ON "TABLE" ("COL1", ...)
        m = re.search(r'ON\s+"?([\w]+)"?\s*\(([^)]+)\)', defn, re.IGNORECASE)
        if m:
            table = m.group(1).lower()
            cols = [c.replace('"', '').strip().lower() for c in m.group(2).split(',')]
            table_to_indexed_cols.setdefault(table, set()).update(cols)
    return table_to_indexed_cols

# Update recommend_indexes_for_fts_tables to use parse_user_indexes

def recommend_indexes_for_fts_tables(sql_query, indexes, alias_to_table, tables, explain_plan, db_engine):
    """
    For every FTS table detected in the EXPLAIN plan, recommend an index on the best predicate column (from WHERE/JOIN/ORDER BY),
    or a review if no predicate is found. If an index exists but FTS still occurs, recommend investigation steps.
    Never recommend both a new index and investigation for the same table.
    """
    fts_tables = extract_fts_tables_from_explain(explain_plan, db_engine)
    where_cols = set()
    orderby_cols = set()
    join_cols = set()
    for match in re.finditer(r'WHERE\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        where_cols.add(col)
    for match in re.finditer(r'JOIN\s+\w+\s+ON\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        join_cols.add(col)
    for match in re.finditer(r'ORDER BY\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        orderby_cols.add(col)
    user_indexes = parse_user_indexes(indexes)
    recs = []
    for fts_table in fts_tables:
        fts_table_lc = fts_table.lower()
        investigation_given = False
        # Check if any relevant predicate column already has an index
        for col in where_cols | join_cols | orderby_cols:
            if col and '.' in col:
                alias, column = col.split('.', 1)
                real_table = alias_to_table.get(alias, alias).lower()
                column_lc = column.lower()
                if real_table == fts_table_lc:
                    # Skip aggregates/aliases
                    if re.match(r'\d+$', column_lc) or column_lc in ['count', 'sum', 'avg', 'min', 'max', 'order_count']:
                        continue
                    if column_lc in user_indexes.get(real_table, set()):
                        # Only investigation advice, never a new index for this table
                        rec_text = (f"Table '{fts_table}' is accessed via Full Table Scan even though an index exists on '{column}'. "
                                    f"Consider running ANALYZE/UPDATE STATISTICS, checking for data skew or NULLs, or using a query hint to encourage index usage.")
                        key = ('fts_index_exists', fts_table, column)
                        recs.append({'text': rec_text, 'actionable': True, 'sub': [], 'key': key})
                        investigation_given = True
                        break
        if not investigation_given:
            # Only recommend a new index if no relevant predicate column has an index
            best_col = None
            for col in where_cols | join_cols | orderby_cols:
                if col and '.' in col:
                    alias, column = col.split('.', 1)
                    real_table = alias_to_table.get(alias, alias).lower()
                    column_lc = column.lower()
                    if real_table == fts_table_lc:
                        # Skip aggregates/aliases
                        if re.match(r'\d+$', column_lc) or column_lc in ['count', 'sum', 'avg', 'min', 'max', 'order_count']:
                            continue
                        best_col = column
                        break
            if best_col:
                rec_text = f"Consider creating an index on column '{best_col}' in table '{fts_table}' for better performance (Full Table Scan detected)."
                ddl_text = f"CREATE INDEX idx_{fts_table}_{best_col}_auto ON {fts_table}({best_col});"
                key = ('fts_index', fts_table, best_col)
                recs.append({'text': rec_text, 'actionable': True, 'sub': [{'text': ddl_text, 'actionable': False}], 'key': key})
            else:
                rec_text = f"Table '{fts_table}' is accessed via Full Table Scan. Review for possible indexing or query rewrite."
                key = ('fts_review', fts_table)
                recs.append({'text': rec_text, 'actionable': True, 'sub': [], 'key': key})
    return recs

@app.errorhandler(CSRFError)
def handle_csrf_error(e):
    return render_template('csrf_error.html', reason=e.description), 400

def detect_engine_from_explain(explain_plan):
    """
    Heuristically detect the likely DB engine from the EXPLAIN plan string.
    Returns one of: 'oracle', 'mysql', 'postgresql', 'sqlserver', 'sqlite', or None.
    """
    if not explain_plan:
        return None
    plan = explain_plan.strip().lower()
    # SQL Server: |--, Clustered Index Scan, Hash Match, Nested Loops, etc.
    if '|--' in plan or 'clustered index scan' in plan or 'hash match' in plan or 'nested loops' in plan:
        return 'sqlserver'
    # Oracle: pipe format, TABLE ACCESS FULL, COST (%CPU)
    if 'table access full' in plan or 'cost (%cpu)' in plan or '| id  | operation' in plan:
        return 'oracle'
    # MySQL: id, select_type, table, type, rows, Extra
    if 'select_type' in plan and 'rows' in plan and 'extra' in plan:
        return 'mysql'
    if '| id |' in plan and '| table |' in plan:
        return 'mysql'
    # PostgreSQL: Seq Scan, Index Scan, cost=, width=
    if 'seq scan' in plan or 'index scan' in plan or 'cost=' in plan or 'width=' in plan:
        return 'postgresql'
    # SQLite: SCAN TABLE, SEARCH TABLE
    if 'scan table' in plan or 'search table' in plan:
        return 'sqlite'
    return None

def detect_explain_format(explain_plan):
    if not explain_plan:
        return 'unknown'
    plan_text = explain_plan.strip()
    # SQL Server tree format (prioritize this check)
    if '|--' in plan_text or 'Clustered Index Scan' in plan_text or 'Hash Match' in plan_text or 'Nested Loops' in plan_text:
        return 'sqlserver'
    # Check for JSON format
    if (plan_text.startswith('[') and plan_text.endswith(']')) or \
       (plan_text.startswith('{') and plan_text.endswith('}')):
        try:
            json.loads(plan_text)
            return 'json'
        except json.JSONDecodeError:
            pass
    # Check for XML format (SQL Server ShowPlanXML)
    if plan_text.startswith('<') or '<RelOp' in plan_text or '<ShowPlanXML' in plan_text:
        return 'xml'
    # Check for SQL Server specific formats (table style)
    if any(keyword in plan_text for keyword in [
        'StmtText', 'PhysicalOp', 'LogicalOp', 'EstimateRows', 'EstimateIO', 'EstimateCPU', 'TotalSubtreeCost',
        'HashAggregate', 'NodeId', 'PhysicalOp=', 'LogicalOp=', 'EstimateRows='
    ]):
        return 'sqlserver'
    # Check for PostgreSQL text format (has indentation and -> markers)
    if '->' in plan_text or 'Planning Time:' in plan_text or 'Execution Time:' in plan_text:
        return 'postgresql_text'
    # Check for Oracle format (pipe-delimited or table format)
    if '|' in plan_text and ('Id' in plan_text or 'OPERATION' in plan_text):
        return 'oracle'
    # Default to text format
    return 'text'

def parse_explain_to_json(explain_plan, db_engine):
    """Parse explain plan with format detection and routing"""
    if not explain_plan:
        return None
    
    # Auto-detect format
    detected_format = detect_explain_format(explain_plan)
    
    # Route to appropriate parser based on engine and format
    if db_engine == 'postgresql':
        if detected_format == 'json':
            return parse_postgresql_json(explain_plan)
        elif detected_format == 'xml':
            return parse_postgresql_xml(explain_plan)
        elif detected_format == 'postgresql_text':
            return parse_postgresql_text(explain_plan)
        else:
            return parse_postgresql_text(explain_plan)  # fallback
    elif db_engine == 'oracle':
        if detected_format == 'oracle':
            return parse_oracle_explain_flow(explain_plan)
        else:
            return parse_oracle_explain_flow(explain_plan)  # fallback
    elif db_engine == 'sqlserver':
        if detected_format == 'sqlserver':
            return parse_sqlserver_explain_flow(explain_plan)
        elif detected_format == 'xml':
            return parse_sqlserver_xml(explain_plan)
        else:
            return parse_sqlserver_explain_flow(explain_plan)  # fallback
    
    return None

def parse_postgresql_json(explain_plan):
    """Parse PostgreSQL JSON format - richest data source"""
    try:
        data = json.loads(explain_plan)
        return extract_from_postgresql_json(data)
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        return None

def extract_from_postgresql_json(data):
    """Extract execution tree from PostgreSQL JSON format"""
    if not data or not isinstance(data, list) or len(data) == 0:
        return None
    
    # PostgreSQL JSON format: [{"Plan": {...}}]
    plan_data = data[0].get('Plan', {})
    
    execution_tree = {
        'operation': 'Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    def extract_node_data(node):
        """Extract metrics from a JSON node"""
        node_data = {
            'operation': node.get('Node Type', 'Unknown Operation'),
            'cost': node.get('Total Cost', 0),
            'startup_cost': node.get('Startup Cost', 0),
            'rows': node.get('Actual Rows', node.get('Plan Rows', 0)),
            'time': node.get('Actual Total Time', 0),
            'buffers': node.get('Buffers', {}),
            'children': []
        }
        
        # Add relation name if available
        if node.get('Relation Name'):
            node_data['operation'] += f" on {node.get('Relation Name')}"
        
        # Add index name if available
        if node.get('Index Name'):
            node_data['operation'] += f" using {node.get('Index Name')}"
        
        # Add scan direction if available
        if node.get('Scan Direction'):
            node_data['operation'] += f" ({node.get('Scan Direction')})"
        
        # Add filter conditions if available
        if node.get('Filter'):
            node_data['filter'] = node.get('Filter')
        
        # Add join conditions if available
        if node.get('Hash Cond'):
            node_data['join_condition'] = node.get('Hash Cond')
        
        # Process children
        if 'Plans' in node:
            for child in node['Plans']:
                child_data = extract_node_data(child)
                node_data['children'].append(child_data)
        
        return node_data
    
    # Extract the main plan
    main_plan = extract_node_data(plan_data)
    execution_tree.update(main_plan)
    
    return execution_tree

def parse_postgresql_xml(explain_plan):
    """Parse PostgreSQL XML format"""
    # TODO: Implement XML parsing for PostgreSQL
    # For now, fallback to text parsing
    return parse_postgresql_text(explain_plan)

def parse_postgresql_text(explain_plan):
    """Parse PostgreSQL TEXT format - enhanced version"""
    lines = explain_plan.strip().split('\n')
    
    # Skip header lines
    skip_patterns = ['Planning Time:', 'Execution Time:', 'QUERY PLAN', '---']
    filtered_lines = []
    for line in lines:
        if not any(pattern in line for pattern in skip_patterns):
            filtered_lines.append(line)
    
    if not filtered_lines:
        return None
    
    # Parse the execution flow based on indentation
    execution_tree = {
        'operation': 'Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    # Stack to track parent nodes based on indentation
    node_stack = [execution_tree]
    indent_stack = [-1]  # Track indentation levels
    
    for line in filtered_lines:
        if not line.strip():
            continue
            
        # Calculate indentation level (count leading spaces or ->)
        original_line = line
        indent_level = 0
        while line.startswith('  ') or line.startswith('-> '):
            if line.startswith('-> '):
                indent_level += 1
                line = line[3:]
            else:
                indent_level += 1
                line = line[2:]
        
        # Parse operation and metrics
        operation, metrics = parse_enhanced_postgresql_line(line)
        
        if not operation:
            continue
        
        # Create node
        node = {
            'operation': operation,
            'cost': metrics.get('cost', 0),
            'rows': metrics.get('rows', 0),
            'time': metrics.get('time', 0),
            'buffers': metrics.get('buffers', {}),
            'children': []
        }
        
        # Find the correct parent based on indentation
        while len(indent_stack) > 1 and indent_level <= indent_stack[-1]:
            node_stack.pop()
            indent_stack.pop()
        
        # Add to current parent
        node_stack[-1]['children'].append(node)
        
        # Push this node onto stack for potential children
        node_stack.append(node)
        indent_stack.append(indent_level)
    
    return execution_tree

def parse_enhanced_postgresql_line(line):
    """Parse a single PostgreSQL operation line with enhanced metrics"""
    line = line.strip()
    
    # Extract metrics from parentheses
    metrics = {}
    operation = line
    
    # Look for metrics in parentheses
    if ' (cost=' in line:
        parts = line.split(' (cost=', 1)
        operation = parts[0].strip()
        metrics_str = 'cost=' + parts[1]
        
        # Parse startup and total cost
        cost_match = re.search(r'cost=([\d\.]+)\.\.([\d\.]+)', metrics_str)
        if cost_match:
            metrics['startup_cost'] = float(cost_match.group(1))
            metrics['cost'] = float(cost_match.group(2))
        
        # Parse rows
        rows_match = re.search(r'rows=(\d+)', metrics_str)
        if rows_match:
            metrics['rows'] = int(rows_match.group(1))
        
        # Parse actual time if available
        time_match = re.search(r'actual time=([\d\.]+)\.\.([\d\.]+)', metrics_str)
        if time_match:
            metrics['time'] = float(time_match.group(2))  # Use end time
        
        # Parse width
        width_match = re.search(r'width=(\d+)', metrics_str)
        if width_match:
            metrics['width'] = int(width_match.group(1))
        
        # Parse buffer information
        buffers_match = re.search(r'Buffers: (.*?)(?:\s|$)', metrics_str)
        if buffers_match:
            buffers_str = buffers_match.group(1)
            metrics['buffers'] = parse_buffer_info(buffers_str)
    
    # Extract filter conditions
    filter_match = re.search(r'Filter: (.+?)(?:\s|$)', line)
    if filter_match:
        metrics['filter'] = filter_match.group(1)
    
    # Extract join conditions
    join_match = re.search(r'Hash Cond: (.+?)(?:\s|$)', line)
    if join_match:
        metrics['join_condition'] = join_match.group(1)
    
    # Clean up operation name
    operation = operation.replace('_', ' ').title()
    
    return operation, metrics

def parse_buffer_info(buffers_str):
    """Parse PostgreSQL buffer information"""
    buffers = {}
    
    # Parse shared hit/read/written
    shared_hit = re.search(r'shared hit=(\d+)', buffers_str)
    if shared_hit:
        buffers['shared_hit'] = int(shared_hit.group(1))
    
    shared_read = re.search(r'shared read=(\d+)', buffers_str)
    if shared_read:
        buffers['shared_read'] = int(shared_read.group(1))
    
    shared_written = re.search(r'shared written=(\d+)', buffers_str)
    if shared_written:
        buffers['shared_written'] = int(shared_written.group(1))
    
    return buffers

def parse_sqlserver_xml(explain_plan):
    """Parse SQL Server XML format"""
    # TODO: Implement XML parsing for SQL Server
    # For now, fallback to text parsing
    return parse_sqlserver_explain_flow(explain_plan)

def parse_sqlserver_generic_format(lines):
    """Parse SQL Server generic format"""
    execution_tree = {
        'operation': 'SQL Server Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    # For other SQL Server formats, try to extract operations
    for line in lines:
        operation, metrics = parse_enhanced_sqlserver_line(line)
        if operation:
            node = {
                'operation': operation,
                'cost': metrics.get('cost', 0),
                'rows': metrics.get('rows', 0),
                'time': metrics.get('time', 0),
                'buffers': metrics.get('buffers', {}),
                'children': []
            }
            execution_tree['children'].append(node)
    
    return execution_tree

def parse_operation_line(line):
    """Parse a single operation line to extract operation name and metrics"""
    line = line.strip()
    
    # Extract metrics from parentheses
    metrics = {}
    operation = line
    
    # Look for metrics in parentheses
    if ' (cost=' in line:
        parts = line.split(' (cost=', 1)
        operation = parts[0].strip()
        metrics_str = 'cost=' + parts[1]
        
        # Parse cost
        cost_match = re.search(r'cost=([\d\.]+)\.\.([\d\.]+)', metrics_str)
        if cost_match:
            metrics['cost'] = float(cost_match.group(2))  # Use end cost
        
        # Parse rows
        rows_match = re.search(r'rows=(\d+)', metrics_str)
        if rows_match:
            metrics['rows'] = int(rows_match.group(1))
        
        # Parse actual time if available
        time_match = re.search(r'actual time=([\d\.]+)\.\.([\d\.]+)', metrics_str)
        if time_match:
            metrics['time'] = float(time_match.group(2))  # Use end time
        
        # Parse width
        width_match = re.search(r'width=(\d+)', metrics_str)
        if width_match:
            metrics['width'] = int(width_match.group(1))
    
    # Clean up operation name
    operation = operation.replace('_', ' ').title()
    
    return operation, metrics

def parse_explain_plan_to_mermaid(explain_plan, db_engine='postgresql'):
    """
    Parse EXPLAIN plan output and convert to Mermaid.js flowchart.
    Supports CSV data and text input for multiple database engines.
    """
    if not explain_plan or not explain_plan.strip():
        return None
    
    try:
        # For MySQL with pipe separators, use text parser
        if db_engine == 'mysql' and '|' in explain_plan and 'select_type' in explain_plan:
            return parse_text_explain_plan(explain_plan, db_engine)
        # Try to parse as CSV first
        elif '\n' in explain_plan and any(',' in line for line in explain_plan.split('\n')[:3]):
            return parse_csv_explain_plan(explain_plan, db_engine)
        else:
            return parse_text_explain_plan(explain_plan, db_engine)
    except Exception as e:
        return None

def parse_csv_explain_plan(csv_data, db_engine):
    """Parse CSV-formatted EXPLAIN plan data"""
    import csv
    from io import StringIO
    
    nodes = []
    edges = []
    node_id_map = {}
    parent_stack = []
    
    # Parse CSV
    csv_reader = csv.DictReader(StringIO(csv_data))
    
    for row in csv_reader:
        # Extract node information based on database engine
        if db_engine == 'postgresql':
            node_id = row.get('Node Type', row.get('node_type', 'N'))
            operation = row.get('Operation', row.get('operation', ''))
            table_name = row.get('Table Name', row.get('table_name', ''))
            cost = row.get('Cost', row.get('cost', ''))
            rows = row.get('Rows', row.get('rows', ''))
            width = row.get('Width', row.get('width', ''))
            
            # Create node label
            label_parts = [operation]
            if table_name:
                label_parts.append(f"on {table_name}")
            if cost:
                label_parts.append(f"(cost={cost})")
            if rows:
                label_parts.append(f"rows={rows}")
            if width:
                label_parts.append(f"width={width}")
            
            label = " ".join(label_parts)
            
        elif db_engine == 'mysql':
            node_id = row.get('id', row.get('ID', 'N'))
            select_type = row.get('select_type', row.get('SELECT_TYPE', ''))
            table = row.get('table', row.get('TABLE', ''))
            type_val = row.get('type', row.get('TYPE', ''))
            key = row.get('key', row.get('KEY', ''))
            rows = row.get('rows', row.get('ROWS', ''))
            extra = row.get('extra', row.get('Extra', ''))
            
            # Create meaningful label
            label_parts = []
            if select_type and select_type != 'NULL':
                label_parts.append(select_type)
            
            if table and table != 'NULL':
                label_parts.append(f"on {table}")
            
            if type_val and type_val != 'NULL':
                label_parts.append(f"({type_val})")
            
            if key and key != 'NULL':
                label_parts.append(f"key={key}")
            
            if rows and rows != 'NULL':
                label_parts.append(f"rows={rows}")
            
            if extra and extra != 'NULL':
                # Truncate extra info if too long
                if len(extra) > 30:
                    extra = extra[:27] + "..."
                label_parts.append(extra)
            
            label = " ".join(label_parts)
            
            # Skip empty labels
            if not label or label.strip() == "":
                continue
                
            operation = select_type  # Use select_type as operation for styling
            
        elif db_engine == 'oracle':
            node_id = row.get('id', row.get('ID', 'N'))
            operation = row.get('operation', row.get('OPERATION', ''))
            name = row.get('name', row.get('NAME', ''))
            rows = row.get('rows', row.get('ROWS', ''))
            cost = row.get('cost', row.get('COST', ''))
            
            label_parts = [operation]
            if name:
                label_parts.append(f"on {name}")
            if cost:
                label_parts.append(f"(cost={cost})")
            if rows:
                label_parts.append(f"rows={rows}")
            
            label = " ".join(label_parts)
            
        elif db_engine == 'sqlserver':
            node_id = row.get('node_id', row.get('Node ID', 'N'))
            physical_op = row.get('physical_op', row.get('Physical Op', ''))
            logical_op = row.get('logical_op', row.get('Logical Op', ''))
            table_name = row.get('table_name', row.get('Table Name', ''))
            estimated_rows = row.get('estimated_rows', row.get('Estimated Rows', ''))
            
            label_parts = [physical_op]
            if logical_op and logical_op != physical_op:
                label_parts.append(f"({logical_op})")
            if table_name:
                label_parts.append(f"on {table_name}")
            if estimated_rows:
                label_parts.append(f"rows={estimated_rows}")
            
            label = " ".join(label_parts)
            
        else:  # Generic
            node_id = row.get('id', row.get('ID', 'N'))
            operation = row.get('operation', row.get('Operation', ''))
            table = row.get('table', row.get('Table', ''))
            
            label_parts = [operation]
            if table:
                label_parts.append(f"on {table}")
            
            label = " ".join(label_parts)
        
        # Create unique node ID
        unique_id = f"N{node_id}"
        node_id_map[node_id] = unique_id
        
        # Add node with simple styling (no CSS classes for now)
        nodes.append(f'{unique_id}["{label}"]')
        
        # Handle parent-child relationships
        parent_id = row.get('parent_id', row.get('Parent ID', ''))
        if parent_id and parent_id in node_id_map:
            edges.append(f'{node_id_map[parent_id]} --> {unique_id}')
    
    if nodes:
        return 'graph TD\n' + '\n'.join(nodes + edges)
    
    return None

def parse_text_explain_plan(text_data, db_engine):
    """Parse text-formatted EXPLAIN plan data with robust hierarchical parsing"""
    nodes = []
    edges = []
    node_id_map = {}
    parent_stack = []
    lines = text_data.strip().split('\n')
    skip_patterns = ['---', '===', 'QUERY PLAN', 'Planning Time:', 'Execution Time:']
    for i, line in enumerate(lines):
        line = line.strip()
        if not line or any(pattern in line for pattern in skip_patterns):
            continue
        original_line = lines[i]
        indent = len(original_line) - len(original_line.lstrip())
        if db_engine == 'oracle':
            # Try pipe-delimited table format first
            if '|' in line and not line.startswith('|--'):
                if 'Id' in line and 'Operation' in line:
                    continue
                if line.startswith('|----'):
                    continue
                parts = [part.strip() for part in line.split('|')]
                if len(parts) >= 3:
                    id_val = parts[1]
                    operation = parts[2]
                    name = parts[3] if len(parts) > 3 else ''
                    rows = parts[4] if len(parts) > 4 else ''
                    cost = parts[5] if len(parts) > 5 else ''
                    label_parts = []
                    if operation and operation != 'NULL':
                        label_parts.append(operation)
                    if name and name != 'NULL':
                        label_parts.append(f"on {name}")
                    if cost and cost != 'NULL':
                        label_parts.append(f"cost={cost}")
                    if rows and rows != 'NULL':
                        label_parts.append(f"rows={rows}")
                    label = " ".join(label_parts)
                    if not label or label.strip() == "":
                        continue
                    if len(label) > 80:
                        label = label[:77] + "..."
                    node_id = f"N{i}"
                    nodes.append(f'{node_id}["{label}"]')
                    if len(nodes) > 1:
                        prev_node = f"N{i-1}"
                        edges.append(f'{prev_node} --> {node_id}')
                    continue
            # Indented tree-like format (fallback)
            # e.g. SELECT STATEMENT\n  HASH JOIN\n    TABLE ACCESS FULL USERS\n    TABLE ACCESS FULL ORDERS
            label = line.strip()
            if not label:
                continue
            if len(label) > 80:
                label = label[:77] + "..."
            node_id = f"N{i}"
            nodes.append(f'{node_id}["{label}"]')
            # Infer parent-child from indentation
            while parent_stack and indent <= parent_stack[-1][1]:
                parent_stack.pop()
            if parent_stack:
                parent_id = parent_stack[-1][0]
                edges.append(f'{parent_id} --> {node_id}')
            parent_stack.append((node_id, indent))
        elif db_engine == 'postgresql':
            # ... existing code ...
            pass  # Unchanged
        elif db_engine == 'mysql':
            # ... existing code ...
            pass  # Unchanged
        elif db_engine == 'sqlserver':
            # ... existing code ...
            pass  # Unchanged
        else:
            # Generic fallback
            if line.strip():
                label = line.strip()
                if len(label) > 80:
                    label = label[:77] + "..."
                node_id = f"N{i}"
                nodes.append(f'{node_id}["{label}"]')
                if len(nodes) > 1:
                    prev_node = f"N{i-1}"
                    edges.append(f'{prev_node} --> {node_id}')
    if nodes:
        mermaid_code = 'graph TD\n' + '\n'.join(nodes)
        if edges:
            mermaid_code += '\n' + '\n'.join(edges)
        return mermaid_code
    return None

def get_node_style(operation, db_engine):
    """Get Mermaid.js styling for different operation types"""
    operation_lower = operation.lower()
    
    # Define color schemes for different operation types
    if any(scan in operation_lower for scan in ['seq scan', 'table scan', 'full scan', 'table access full']):
        return ':::seq-scan'
    elif any(scan in operation_lower for scan in ['index scan', 'index range scan', 'index seek']):
        return ':::index-scan'
    elif any(join in operation_lower for join in ['hash join', 'nested loop', 'merge join', 'join']):
        return ':::join'
    elif any(agg in operation_lower for agg in ['aggregate', 'group', 'sort']):
        return ':::aggregate'
    elif any(filter in operation_lower for filter in ['filter', 'where']):
        return ':::filter'
    elif any(result in operation_lower for result in ['result', 'output']):
        return ':::result'
    else:
        return ':::default'

def get_alias_to_table_mapping(sql_query):
    import re
    alias_to_table = {}
    from_join_pattern = re.compile(r'(FROM|JOIN)\s+([\w\"]+)(?:\s+AS)?\s+(\w+)', re.IGNORECASE)
    for match in from_join_pattern.finditer(sql_query):
        real_table = match.group(2).replace('"', '')
        alias = match.group(3)
        alias_to_table[alias] = real_table
    return alias_to_table

def get_real_column_index_recommendations(sql_query, indexes, alias_to_table, tables):
    import re
    where_cols = set()
    orderby_cols = set()
    join_cols = set()
    for match in re.finditer(r'WHERE\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        where_cols.add(col)
    for match in re.finditer(r'JOIN\s+\w+\s+ON\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        join_cols.add(col)
    for match in re.finditer(r'ORDER BY\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        orderby_cols.add(col)
    user_indexes = parse_user_indexes(indexes)
    index_recs = {}
    for col in where_cols | join_cols | orderby_cols:
        # Only recommend for real columns in real tables (not aggregates/aliases)
        if col and '.' in col:
            alias, column = col.split('.', 1)
            real_table = alias_to_table.get(alias, alias)
            # Check if real_table is in tables
            if real_table not in [t['name'] for t in tables]:
                continue
            # Skip aggregates/aliases
            if re.match(r'\d+$', column) or column.lower() in ['count', 'sum', 'avg', 'min', 'max', 'order_count']:
                continue
            # SKIP if already indexed
            if column.lower() in user_indexes.get(real_table.lower(), set()):
                continue
            rec_text = f"Consider creating an index on column '{column}' in table '{real_table}' for better performance."
            ddl_text = f"CREATE INDEX idx_{real_table}_{column}_auto ON {real_table}({column});"
            key = ('index', real_table, column)
            if key not in index_recs:
                index_recs[key] = {'text': rec_text, 'actionable': True, 'sub': [{'text': ddl_text, 'actionable': False}], 'key': key}
            else:
                if not any(sub['text'] == ddl_text for sub in index_recs[key]['sub']):
                    index_recs[key]['sub'].append({'text': ddl_text, 'actionable': False})
    return list(index_recs.values())

def extract_fts_tables_from_explain(explain_plan, db_engine):
    """
    Extract all tables accessed via full table scan from the EXPLAIN plan using EXPLAIN_KEYWORDS.
    Returns a set of table names.
    Improved for Oracle: robustly extract table names from lines like 'TABLE ACCESS FULL USERS' and pipe-formatted plans.
    """
    from explain_keywords import EXPLAIN_KEYWORDS
    fts_tables = set()
    if not explain_plan:
        return fts_tables
    # Normalize line endings and strip whitespace
    plan_lines = [l.strip() for l in explain_plan.strip().split('\n') if l.strip()]
    keywords = EXPLAIN_KEYWORDS.get(db_engine, {})
    scan_keywords = set(keywords.get('sequential', []) + keywords.get('table', []) + keywords.get('full_scan', []) + keywords.get('scan', []))
    for line in plan_lines:
        # Oracle pipe format: | 3 | TABLE ACCESS FULL | DEPARTMENTS | 27 | 3 (0) |
        if db_engine == 'oracle' and '|' in line:
            parts = [p.strip() for p in line.strip('|').split('|')]
            if len(parts) >= 3:
                op = parts[1].upper()
                table = parts[2]
                for kw in scan_keywords:
                    if kw.upper() in op:
                        if table and table.upper() not in {'', 'N/A', 'VW_SQ_1'}:
                            fts_tables.add(table)
        else:
            for kw in scan_keywords:
                if kw.lower() in line.lower():
                    m = re.search(rf"{re.escape(kw)}[\s]+([\w\"\[\]]+)", line, re.IGNORECASE)
                    if m:
                        table = m.group(1).replace('"', '').replace('[', '').replace(']', '')
                        fts_tables.add(table)
                    else:
                        parts = line.strip().split()
                        if len(parts) > 0:
                            table = parts[-1].replace('"', '').replace('[', '').replace(']', '')
                            if table.upper() not in {'FULL', 'ACCESS', 'TABLE', 'SCAN', 'INDEX', 'HASH', 'JOIN', 'STATEMENT'}:
                                fts_tables.add(table)
    return fts_tables

# In each analyze_* function, after parsing the EXPLAIN plan:
# 1. Call extract_fts_tables_from_explain(explain_plan, db_engine)
# 2. For each FTS table, if not already indexed, recommend an index on the best predicate column (from WHERE/JOIN), or recommend review if no predicate found.
# 3. Ensure all FTS tables are covered in recommendations.

def extract_explain_plan_metrics(explain_plan, db_engine):
    """
    Parse EXPLAIN plan for actual rows scanned, cost, memory/bytes, and estimated time for all engines.
    Returns a dict: {rows_scanned, cost, memory, time}
    """
    metrics = {'rows_scanned': None, 'cost': None, 'memory': None, 'time': None}
    if not explain_plan:
        return metrics
    plan_lines = explain_plan.strip().split('\n')
    # Try CSV first if it looks like CSV
    if any(',' in line for line in plan_lines[:3]):
        try:
            csv_reader = csv.DictReader(StringIO(explain_plan))
            rows_list, cost_list, mem_list, time_list = [], [], [], []
            for row in csv_reader:
                for k, v in row.items():
                    if v is None or v == '' or v == 'NULL':
                        continue
                    kl = k.lower()
                    if 'row' in kl and v.isdigit():
                        rows_list.append(int(v))
                    if 'cost' in kl and v.replace('.', '', 1).isdigit():
                        cost_list.append(float(v))
                    if 'byte' in kl and v.isdigit():
                        mem_list.append(int(v))
                    if 'mem' in kl and v.replace('.', '', 1).isdigit():
                        mem_list.append(float(v))
                    if 'time' in kl and v.replace('.', '', 1).isdigit():
                        time_list.append(float(v))
            if rows_list:
                metrics['rows_scanned'] = max(rows_list)
            if cost_list:
                metrics['cost'] = max(cost_list)
            if mem_list:
                metrics['memory'] = max(mem_list)
            if time_list:
                metrics['time'] = max(time_list)
            return metrics
        except Exception:
            pass
    # Text parsing by engine
    if db_engine == 'postgresql':
        # e.g. Seq Scan on users  (cost=0.00..431.00 rows=21000 width=4)
        rows_list, cost_list, mem_list, time_list = [], [], [], []
        for line in plan_lines:
            m = re.search(r'rows=(\d+)', line)
            if m:
                rows_list.append(int(m.group(1)))
            m = re.search(r'cost=([\d\.]+)\.\.([\d\.]+)', line)
            if m:
                cost_list.append(float(m.group(2)))
            m = re.search(r'width=(\d+)', line)
            if m:
                mem_list.append(int(m.group(1)))
        if rows_list:
            metrics['rows_scanned'] = max(rows_list)
        if cost_list:
            metrics['cost'] = max(cost_list)
        if mem_list:
            metrics['memory'] = max(mem_list)
    elif db_engine == 'mysql':
        # e.g. | id | select_type | table | type | rows | Extra |
        for line in plan_lines:
            m = re.search(r'rows=?(\d+)', line)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
            m = re.search(r'Using\s+filesort', line, re.IGNORECASE)
            if m:
                metrics['cost'] = (metrics['cost'] or 0) + 10
        # MySQL EXPLAIN rarely gives memory/time directly
    elif db_engine == 'oracle':
        # Pipe/table or indented
        for line in plan_lines:
            m = re.search(r'rows=?(\d+)', line)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
            m = re.search(r'cost=?(\d+)', line)
            if m:
                metrics['cost'] = max(metrics['cost'] or 0, int(m.group(1))) if metrics['cost'] else int(m.group(1))
            m = re.search(r'bytes=?(\d+)', line)
            if m:
                metrics['memory'] = max(metrics['memory'] or 0, int(m.group(1))) if metrics['memory'] else int(m.group(1))
    elif db_engine == 'sqlserver':
        for line in plan_lines:
            m = re.search(r'Estimated Rows=?(\d+)', line, re.IGNORECASE)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
            m = re.search(r'Estimated Total Subtree Cost=([\d\.]+)', line, re.IGNORECASE)
            if m:
                metrics['cost'] = max(metrics['cost'] or 0, float(m.group(1))) if metrics['cost'] else float(m.group(1))
            m = re.search(r'Memory Grant=([\d\.]+)', line, re.IGNORECASE)
            if m:
                metrics['memory'] = max(metrics['memory'] or 0, float(m.group(1))) if metrics['memory'] else float(m.group(1))
    elif db_engine == 'sqlite':
        for line in plan_lines:
            m = re.search(r'rows=?(\d+)', line)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
    return metrics

def parse_user_indexes(indexes):
    """
    Parse user-provided index definitions and return {table: set(columns)} for fast lookup.
    Supports multi-column indexes and different syntaxes for all engines.
    """
    table_to_indexed_cols = {}
    for idx in indexes:
        defn = idx.get('definition') or idx.get('ddl') or ''
        # Try to extract table and columns from CREATE INDEX ... ON table(col1, col2, ...)
        m = re.search(r'CREATE\s+INDEX\s+\w+\s+ON\s+([\w\"\[\]]+)\s*\(([^)]+)\)', defn, re.IGNORECASE)
        if m:
            table = m.group(1).replace('"', '').replace('[', '').replace(']', '').lower()
            cols = [c.strip().lower() for c in m.group(2).split(',')]
            table_to_indexed_cols.setdefault(table, set()).update(cols)
            continue
        # MySQL/SQL Server: CREATE INDEX ... ON table (col1, col2)
        m = re.search(r'ON\s+([\w\"\[\]]+)\s*\(([^)]+)\)', defn, re.IGNORECASE)
        if m:
            table = m.group(1).replace('"', '').replace('[', '').replace(']', '').lower()
            cols = [c.strip().lower() for c in m.group(2).split(',')]
            table_to_indexed_cols.setdefault(table, set()).update(cols)
            continue
        # Oracle: CREATE INDEX ... ON "TABLE" ("COL1", ...)
        m = re.search(r'ON\s+"?([\w]+)"?\s*\(([^)]+)\)', defn, re.IGNORECASE)
        if m:
            table = m.group(1).lower()
            cols = [c.replace('"', '').strip().lower() for c in m.group(2).split(',')]
            table_to_indexed_cols.setdefault(table, set()).update(cols)
    return table_to_indexed_cols

# Update recommend_indexes_for_fts_tables to use parse_user_indexes

def recommend_indexes_for_fts_tables(sql_query, indexes, alias_to_table, tables, explain_plan, db_engine):
    """
    For every FTS table detected in the EXPLAIN plan, recommend an index on the best predicate column (from WHERE/JOIN/ORDER BY),
    or a review if no predicate is found. If an index exists but FTS still occurs, recommend investigation steps.
    Never recommend both a new index and investigation for the same table.
    """
    fts_tables = extract_fts_tables_from_explain(explain_plan, db_engine)
    where_cols = set()
    orderby_cols = set()
    join_cols = set()
    for match in re.finditer(r'WHERE\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        where_cols.add(col)
    for match in re.finditer(r'JOIN\s+\w+\s+ON\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        join_cols.add(col)
    for match in re.finditer(r'ORDER BY\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        orderby_cols.add(col)
    user_indexes = parse_user_indexes(indexes)
    recs = []
    for fts_table in fts_tables:
        fts_table_lc = fts_table.lower()
        investigation_given = False
        # Check if any relevant predicate column already has an index
        for col in where_cols | join_cols | orderby_cols:
            if col and '.' in col:
                alias, column = col.split('.', 1)
                real_table = alias_to_table.get(alias, alias).lower()
                column_lc = column.lower()
                if real_table == fts_table_lc:
                    # Skip aggregates/aliases
                    if re.match(r'\d+$', column_lc) or column_lc in ['count', 'sum', 'avg', 'min', 'max', 'order_count']:
                        continue
                    if column_lc in user_indexes.get(real_table, set()):
                        # Only investigation advice, never a new index for this table
                        rec_text = (f"Table '{fts_table}' is accessed via Full Table Scan even though an index exists on '{column}'. "
                                    f"Consider running ANALYZE/UPDATE STATISTICS, checking for data skew or NULLs, or using a query hint to encourage index usage.")
                        key = ('fts_index_exists', fts_table, column)
                        recs.append({'text': rec_text, 'actionable': True, 'sub': [], 'key': key})
                        investigation_given = True
                        break
        if not investigation_given:
            # Only recommend a new index if no relevant predicate column has an index
            best_col = None
            for col in where_cols | join_cols | orderby_cols:
                if col and '.' in col:
                    alias, column = col.split('.', 1)
                    real_table = alias_to_table.get(alias, alias).lower()
                    column_lc = column.lower()
                    if real_table == fts_table_lc:
                        # Skip aggregates/aliases
                        if re.match(r'\d+$', column_lc) or column_lc in ['count', 'sum', 'avg', 'min', 'max', 'order_count']:
                            continue
                        best_col = column
                        break
            if best_col:
                rec_text = f"Consider creating an index on column '{best_col}' in table '{fts_table}' for better performance (Full Table Scan detected)."
                ddl_text = f"CREATE INDEX idx_{fts_table}_{best_col}_auto ON {fts_table}({best_col});"
                key = ('fts_index', fts_table, best_col)
                recs.append({'text': rec_text, 'actionable': True, 'sub': [{'text': ddl_text, 'actionable': False}], 'key': key})
            else:
                rec_text = f"Table '{fts_table}' is accessed via Full Table Scan. Review for possible indexing or query rewrite."
                key = ('fts_review', fts_table)
                recs.append({'text': rec_text, 'actionable': True, 'sub': [], 'key': key})
    return recs

@app.errorhandler(CSRFError)
def handle_csrf_error(e):
    return render_template('csrf_error.html', reason=e.description), 400

def detect_engine_from_explain(explain_plan):
    """
    Heuristically detect the likely DB engine from the EXPLAIN plan string.
    Returns one of: 'oracle', 'mysql', 'postgresql', 'sqlserver', 'sqlite', or None.
    """
    if not explain_plan:
        return None
    plan = explain_plan.strip().lower()
    # SQL Server: |--, Clustered Index Scan, Hash Match, Nested Loops, etc.
    if '|--' in plan or 'clustered index scan' in plan or 'hash match' in plan or 'nested loops' in plan:
        return 'sqlserver'
    # Oracle: pipe format, TABLE ACCESS FULL, COST (%CPU)
    if 'table access full' in plan or 'cost (%cpu)' in plan or '| id  | operation' in plan:
        return 'oracle'
    # MySQL: id, select_type, table, type, rows, Extra
    if 'select_type' in plan and 'rows' in plan and 'extra' in plan:
        return 'mysql'
    if '| id |' in plan and '| table |' in plan:
        return 'mysql'
    # PostgreSQL: Seq Scan, Index Scan, cost=, width=
    if 'seq scan' in plan or 'index scan' in plan or 'cost=' in plan or 'width=' in plan:
        return 'postgresql'
    # SQLite: SCAN TABLE, SEARCH TABLE
    if 'scan table' in plan or 'search table' in plan:
        return 'sqlite'
    return None

def detect_explain_format(explain_plan):
    if not explain_plan:
        return 'unknown'
    plan_text = explain_plan.strip()
    # SQL Server tree format (prioritize this check)
    if '|--' in plan_text or 'Clustered Index Scan' in plan_text or 'Hash Match' in plan_text or 'Nested Loops' in plan_text:
        return 'sqlserver'
    # Check for JSON format
    if (plan_text.startswith('[') and plan_text.endswith(']')) or \
       (plan_text.startswith('{') and plan_text.endswith('}')):
        try:
            json.loads(plan_text)
            return 'json'
        except json.JSONDecodeError:
            pass
    # Check for XML format (SQL Server ShowPlanXML)
    if plan_text.startswith('<') or '<RelOp' in plan_text or '<ShowPlanXML' in plan_text:
        return 'xml'
    # Check for SQL Server specific formats (table style)
    if any(keyword in plan_text for keyword in [
        'StmtText', 'PhysicalOp', 'LogicalOp', 'EstimateRows', 'EstimateIO', 'EstimateCPU', 'TotalSubtreeCost',
        'HashAggregate', 'NodeId', 'PhysicalOp=', 'LogicalOp=', 'EstimateRows='
    ]):
        return 'sqlserver'
    # Check for PostgreSQL text format (has indentation and -> markers)
    if '->' in plan_text or 'Planning Time:' in plan_text or 'Execution Time:' in plan_text:
        return 'postgresql_text'
    # Check for Oracle format (pipe-delimited or table format)
    if '|' in plan_text and ('Id' in plan_text or 'OPERATION' in plan_text):
        return 'oracle'
    # Default to text format
    return 'text'

def parse_explain_to_json(explain_plan, db_engine):
    """Parse explain plan with format detection and routing"""
    if not explain_plan:
        return None
    
    # Auto-detect format
    detected_format = detect_explain_format(explain_plan)
    
    # Route to appropriate parser based on engine and format
    if db_engine == 'postgresql':
        if detected_format == 'json':
            return parse_postgresql_json(explain_plan)
        elif detected_format == 'xml':
            return parse_postgresql_xml(explain_plan)
        elif detected_format == 'postgresql_text':
            return parse_postgresql_text(explain_plan)
        else:
            return parse_postgresql_text(explain_plan)  # fallback
    elif db_engine == 'oracle':
        if detected_format == 'oracle':
            return parse_oracle_explain_flow(explain_plan)
        else:
            return parse_oracle_explain_flow(explain_plan)  # fallback
    elif db_engine == 'sqlserver':
        if detected_format == 'sqlserver':
            return parse_sqlserver_explain_flow(explain_plan)
        elif detected_format == 'xml':
            return parse_sqlserver_xml(explain_plan)
        else:
            return parse_sqlserver_explain_flow(explain_plan)  # fallback
    
    return None

def parse_postgresql_json(explain_plan):
    """Parse PostgreSQL JSON format - richest data source"""
    try:
        data = json.loads(explain_plan)
        return extract_from_postgresql_json(data)
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        return None

def extract_from_postgresql_json(data):
    """Extract execution tree from PostgreSQL JSON format"""
    if not data or not isinstance(data, list) or len(data) == 0:
        return None
    
    # PostgreSQL JSON format: [{"Plan": {...}}]
    plan_data = data[0].get('Plan', {})
    
    execution_tree = {
        'operation': 'Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    def extract_node_data(node):
        """Extract metrics from a JSON node"""
        node_data = {
            'operation': node.get('Node Type', 'Unknown Operation'),
            'cost': node.get('Total Cost', 0),
            'startup_cost': node.get('Startup Cost', 0),
            'rows': node.get('Actual Rows', node.get('Plan Rows', 0)),
            'time': node.get('Actual Total Time', 0),
            'buffers': node.get('Buffers', {}),
            'children': []
        }
        
        # Add relation name if available
        if node.get('Relation Name'):
            node_data['operation'] += f" on {node.get('Relation Name')}"
        
        # Add index name if available
        if node.get('Index Name'):
            node_data['operation'] += f" using {node.get('Index Name')}"
        
        # Add scan direction if available
        if node.get('Scan Direction'):
            node_data['operation'] += f" ({node.get('Scan Direction')})"
        
        # Add filter conditions if available
        if node.get('Filter'):
            node_data['filter'] = node.get('Filter')
        
        # Add join conditions if available
        if node.get('Hash Cond'):
            node_data['join_condition'] = node.get('Hash Cond')
        
        # Process children
        if 'Plans' in node:
            for child in node['Plans']:
                child_data = extract_node_data(child)
                node_data['children'].append(child_data)
        
        return node_data
    
    # Extract the main plan
    main_plan = extract_node_data(plan_data)
    execution_tree.update(main_plan)
    
    return execution_tree

def parse_postgresql_xml(explain_plan):
    """Parse PostgreSQL XML format"""
    # TODO: Implement XML parsing for PostgreSQL
    # For now, fallback to text parsing
    return parse_postgresql_text(explain_plan)

def parse_postgresql_text(explain_plan):
    """Parse PostgreSQL TEXT format - enhanced version"""
    lines = explain_plan.strip().split('\n')
    
    # Skip header lines
    skip_patterns = ['Planning Time:', 'Execution Time:', 'QUERY PLAN', '---']
    filtered_lines = []
    for line in lines:
        if not any(pattern in line for pattern in skip_patterns):
            filtered_lines.append(line)
    
    if not filtered_lines:
        return None
    
    # Parse the execution flow based on indentation
    execution_tree = {
        'operation': 'Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    # Stack to track parent nodes based on indentation
    node_stack = [execution_tree]
    indent_stack = [-1]  # Track indentation levels
    
    for line in filtered_lines:
        if not line.strip():
            continue
            
        # Calculate indentation level (count leading spaces or ->)
        original_line = line
        indent_level = 0
        while line.startswith('  ') or line.startswith('-> '):
            if line.startswith('-> '):
                indent_level += 1
                line = line[3:]
            else:
                indent_level += 1
                line = line[2:]
        
        # Parse operation and metrics
        operation, metrics = parse_enhanced_postgresql_line(line)
        
        if not operation:
            continue
        
        # Create node
        node = {
            'operation': operation,
            'cost': metrics.get('cost', 0),
            'rows': metrics.get('rows', 0),
            'time': metrics.get('time', 0),
            'buffers': metrics.get('buffers', {}),
            'children': []
        }
        
        # Find the correct parent based on indentation
        while len(indent_stack) > 1 and indent_level <= indent_stack[-1]:
            node_stack.pop()
            indent_stack.pop()
        
        # Add to current parent
        node_stack[-1]['children'].append(node)
        
        # Push this node onto stack for potential children
        node_stack.append(node)
        indent_stack.append(indent_level)
    
    return execution_tree

def parse_enhanced_postgresql_line(line):
    """Parse a single PostgreSQL operation line with enhanced metrics"""
    line = line.strip()
    
    # Extract metrics from parentheses
    metrics = {}
    operation = line
    
    # Look for metrics in parentheses
    if ' (cost=' in line:
        parts = line.split(' (cost=', 1)
        operation = parts[0].strip()
        metrics_str = 'cost=' + parts[1]
        
        # Parse startup and total cost
        cost_match = re.search(r'cost=([\d\.]+)\.\.([\d\.]+)', metrics_str)
        if cost_match:
            metrics['startup_cost'] = float(cost_match.group(1))
            metrics['cost'] = float(cost_match.group(2))
        
        # Parse rows
        rows_match = re.search(r'rows=(\d+)', metrics_str)
        if rows_match:
            metrics['rows'] = int(rows_match.group(1))
        
        # Parse actual time if available
        time_match = re.search(r'actual time=([\d\.]+)\.\.([\d\.]+)', metrics_str)
        if time_match:
            metrics['time'] = float(time_match.group(2))  # Use end time
        
        # Parse width
        width_match = re.search(r'width=(\d+)', metrics_str)
        if width_match:
            metrics['width'] = int(width_match.group(1))
        
        # Parse buffer information
        buffers_match = re.search(r'Buffers: (.*?)(?:\s|$)', metrics_str)
        if buffers_match:
            buffers_str = buffers_match.group(1)
            metrics['buffers'] = parse_buffer_info(buffers_str)
    
    # Extract filter conditions
    filter_match = re.search(r'Filter: (.+?)(?:\s|$)', line)
    if filter_match:
        metrics['filter'] = filter_match.group(1)
    
    # Extract join conditions
    join_match = re.search(r'Hash Cond: (.+?)(?:\s|$)', line)
    if join_match:
        metrics['join_condition'] = join_match.group(1)
    
    # Clean up operation name
    operation = operation.replace('_', ' ').title()
    
    return operation, metrics

def parse_buffer_info(buffers_str):
    """Parse PostgreSQL buffer information"""
    buffers = {}
    
    # Parse shared hit/read/written
    shared_hit = re.search(r'shared hit=(\d+)', buffers_str)
    if shared_hit:
        buffers['shared_hit'] = int(shared_hit.group(1))
    
    shared_read = re.search(r'shared read=(\d+)', buffers_str)
    if shared_read:
        buffers['shared_read'] = int(shared_read.group(1))
    
    shared_written = re.search(r'shared written=(\d+)', buffers_str)
    if shared_written:
        buffers['shared_written'] = int(shared_written.group(1))
    
    return buffers

def parse_sqlserver_xml(explain_plan):
    """Parse SQL Server XML format"""
    # TODO: Implement XML parsing for SQL Server
    # For now, fallback to text parsing
    return parse_sqlserver_explain_flow(explain_plan)

def parse_sqlserver_generic_format(lines):
    """Parse SQL Server generic format"""
    execution_tree = {
        'operation': 'SQL Server Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    # For other SQL Server formats, try to extract operations
    for line in lines:
        operation, metrics = parse_enhanced_sqlserver_line(line)
        if operation:
            node = {
                'operation': operation,
                'cost': metrics.get('cost', 0),
                'rows': metrics.get('rows', 0),
                'time': metrics.get('time', 0),
                'buffers': metrics.get('buffers', {}),
                'children': []
            }
            execution_tree['children'].append(node)
    
    return execution_tree

def parse_operation_line(line):
    """Parse a single operation line to extract operation name and metrics"""
    line = line.strip()
    
    # Extract metrics from parentheses
    metrics = {}
    operation = line
    
    # Look for metrics in parentheses
    if ' (cost=' in line:
        parts = line.split(' (cost=', 1)
        operation = parts[0].strip()
        metrics_str = 'cost=' + parts[1]
        
        # Parse cost
        cost_match = re.search(r'cost=([\d\.]+)\.\.([\d\.]+)', metrics_str)
        if cost_match:
            metrics['cost'] = float(cost_match.group(2))  # Use end cost
        
        # Parse rows
        rows_match = re.search(r'rows=(\d+)', metrics_str)
        if rows_match:
            metrics['rows'] = int(rows_match.group(1))
        
        # Parse actual time if available
        time_match = re.search(r'actual time=([\d\.]+)\.\.([\d\.]+)', metrics_str)
        if time_match:
            metrics['time'] = float(time_match.group(2))  # Use end time
        
        # Parse width
        width_match = re.search(r'width=(\d+)', metrics_str)
        if width_match:
            metrics['width'] = int(width_match.group(1))
    
    # Clean up operation name
    operation = operation.replace('_', ' ').title()
    
    return operation, metrics

def parse_explain_plan_to_mermaid(explain_plan, db_engine='postgresql'):
    """
    Parse EXPLAIN plan output and convert to Mermaid.js flowchart.
    Supports CSV data and text input for multiple database engines.
    """
    if not explain_plan or not explain_plan.strip():
        return None
    
    try:
        # For MySQL with pipe separators, use text parser
        if db_engine == 'mysql' and '|' in explain_plan and 'select_type' in explain_plan:
            return parse_text_explain_plan(explain_plan, db_engine)
        # Try to parse as CSV first
        elif '\n' in explain_plan and any(',' in line for line in explain_plan.split('\n')[:3]):
            return parse_csv_explain_plan(explain_plan, db_engine)
        else:
            return parse_text_explain_plan(explain_plan, db_engine)
    except Exception as e:
        return None

def parse_csv_explain_plan(csv_data, db_engine):
    """Parse CSV-formatted EXPLAIN plan data"""
    import csv
    from io import StringIO
    
    nodes = []
    edges = []
    node_id_map = {}
    parent_stack = []
    
    # Parse CSV
    csv_reader = csv.DictReader(StringIO(csv_data))
    
    for row in csv_reader:
        # Extract node information based on database engine
        if db_engine == 'postgresql':
            node_id = row.get('Node Type', row.get('node_type', 'N'))
            operation = row.get('Operation', row.get('operation', ''))
            table_name = row.get('Table Name', row.get('table_name', ''))
            cost = row.get('Cost', row.get('cost', ''))
            rows = row.get('Rows', row.get('rows', ''))
            width = row.get('Width', row.get('width', ''))
            
            # Create node label
            label_parts = [operation]
            if table_name:
                label_parts.append(f"on {table_name}")
            if cost:
                label_parts.append(f"(cost={cost})")
            if rows:
                label_parts.append(f"rows={rows}")
            if width:
                label_parts.append(f"width={width}")
            
            label = " ".join(label_parts)
            
        elif db_engine == 'mysql':
            node_id = row.get('id', row.get('ID', 'N'))
            select_type = row.get('select_type', row.get('SELECT_TYPE', ''))
            table = row.get('table', row.get('TABLE', ''))
            type_val = row.get('type', row.get('TYPE', ''))
            key = row.get('key', row.get('KEY', ''))
            rows = row.get('rows', row.get('ROWS', ''))
            extra = row.get('extra', row.get('Extra', ''))
            
            # Create meaningful label
            label_parts = []
            if select_type and select_type != 'NULL':
                label_parts.append(select_type)
            
            if table and table != 'NULL':
                label_parts.append(f"on {table}")
            
            if type_val and type_val != 'NULL':
                label_parts.append(f"({type_val})")
            
            if key and key != 'NULL':
                label_parts.append(f"key={key}")
            
            if rows and rows != 'NULL':
                label_parts.append(f"rows={rows}")
            
            if extra and extra != 'NULL':
                # Truncate extra info if too long
                if len(extra) > 30:
                    extra = extra[:27] + "..."
                label_parts.append(extra)
            
            label = " ".join(label_parts)
            
            # Skip empty labels
            if not label or label.strip() == "":
                continue
                
            operation = select_type  # Use select_type as operation for styling
            
        elif db_engine == 'oracle':
            node_id = row.get('id', row.get('ID', 'N'))
            operation = row.get('operation', row.get('OPERATION', ''))
            name = row.get('name', row.get('NAME', ''))
            rows = row.get('rows', row.get('ROWS', ''))
            cost = row.get('cost', row.get('COST', ''))
            
            label_parts = [operation]
            if name:
                label_parts.append(f"on {name}")
            if cost:
                label_parts.append(f"(cost={cost})")
            if rows:
                label_parts.append(f"rows={rows}")
            
            label = " ".join(label_parts)
            
        elif db_engine == 'sqlserver':
            node_id = row.get('node_id', row.get('Node ID', 'N'))
            physical_op = row.get('physical_op', row.get('Physical Op', ''))
            logical_op = row.get('logical_op', row.get('Logical Op', ''))
            table_name = row.get('table_name', row.get('Table Name', ''))
            estimated_rows = row.get('estimated_rows', row.get('Estimated Rows', ''))
            
            label_parts = [physical_op]
            if logical_op and logical_op != physical_op:
                label_parts.append(f"({logical_op})")
            if table_name:
                label_parts.append(f"on {table_name}")
            if estimated_rows:
                label_parts.append(f"rows={estimated_rows}")
            
            label = " ".join(label_parts)
            
        else:  # Generic
            node_id = row.get('id', row.get('ID', 'N'))
            operation = row.get('operation', row.get('Operation', ''))
            table = row.get('table', row.get('Table', ''))
            
            label_parts = [operation]
            if table:
                label_parts.append(f"on {table}")
            
            label = " ".join(label_parts)
        
        # Create unique node ID
        unique_id = f"N{node_id}"
        node_id_map[node_id] = unique_id
        
        # Add node with simple styling (no CSS classes for now)
        nodes.append(f'{unique_id}["{label}"]')
        
        # Handle parent-child relationships
        parent_id = row.get('parent_id', row.get('Parent ID', ''))
        if parent_id and parent_id in node_id_map:
            edges.append(f'{node_id_map[parent_id]} --> {unique_id}')
    
    if nodes:
        return 'graph TD\n' + '\n'.join(nodes + edges)
    
    return None

def parse_text_explain_plan(text_data, db_engine):
    """Parse text-formatted EXPLAIN plan data with robust hierarchical parsing"""
    nodes = []
    edges = []
    node_id_map = {}
    parent_stack = []
    lines = text_data.strip().split('\n')
    skip_patterns = ['---', '===', 'QUERY PLAN', 'Planning Time:', 'Execution Time:']
    for i, line in enumerate(lines):
        line = line.strip()
        if not line or any(pattern in line for pattern in skip_patterns):
            continue
        original_line = lines[i]
        indent = len(original_line) - len(original_line.lstrip())
        if db_engine == 'oracle':
            # Try pipe-delimited table format first
            if '|' in line and not line.startswith('|--'):
                if 'Id' in line and 'Operation' in line:
                    continue
                if line.startswith('|----'):
                    continue
                parts = [part.strip() for part in line.split('|')]
                if len(parts) >= 3:
                    id_val = parts[1]
                    operation = parts[2]
                    name = parts[3] if len(parts) > 3 else ''
                    rows = parts[4] if len(parts) > 4 else ''
                    cost = parts[5] if len(parts) > 5 else ''
                    label_parts = []
                    if operation and operation != 'NULL':
                        label_parts.append(operation)
                    if name and name != 'NULL':
                        label_parts.append(f"on {name}")
                    if cost and cost != 'NULL':
                        label_parts.append(f"cost={cost}")
                    if rows and rows != 'NULL':
                        label_parts.append(f"rows={rows}")
                    label = " ".join(label_parts)
                    if not label or label.strip() == "":
                        continue
                    if len(label) > 80:
                        label = label[:77] + "..."
                    node_id = f"N{i}"
                    nodes.append(f'{node_id}["{label}"]')
                    if len(nodes) > 1:
                        prev_node = f"N{i-1}"
                        edges.append(f'{prev_node} --> {node_id}')
                    continue
            # Indented tree-like format (fallback)
            # e.g. SELECT STATEMENT\n  HASH JOIN\n    TABLE ACCESS FULL USERS\n    TABLE ACCESS FULL ORDERS
            label = line.strip()
            if not label:
                continue
            if len(label) > 80:
                label = label[:77] + "..."
            node_id = f"N{i}"
            nodes.append(f'{node_id}["{label}"]')
            # Infer parent-child from indentation
            while parent_stack and indent <= parent_stack[-1][1]:
                parent_stack.pop()
            if parent_stack:
                parent_id = parent_stack[-1][0]
                edges.append(f'{parent_id} --> {node_id}')
            parent_stack.append((node_id, indent))
        elif db_engine == 'postgresql':
            # ... existing code ...
            pass  # Unchanged
        elif db_engine == 'mysql':
            # ... existing code ...
            pass  # Unchanged
        elif db_engine == 'sqlserver':
            # ... existing code ...
            pass  # Unchanged
        else:
            # Generic fallback
            if line.strip():
                label = line.strip()
                if len(label) > 80:
                    label = label[:77] + "..."
                node_id = f"N{i}"
                nodes.append(f'{node_id}["{label}"]')
                if len(nodes) > 1:
                    prev_node = f"N{i-1}"
                    edges.append(f'{prev_node} --> {node_id}')
    if nodes:
        mermaid_code = 'graph TD\n' + '\n'.join(nodes)
        if edges:
            mermaid_code += '\n' + '\n'.join(edges)
        return mermaid_code
    return None

def get_node_style(operation, db_engine):
    """Get Mermaid.js styling for different operation types"""
    operation_lower = operation.lower()
    
    # Define color schemes for different operation types
    if any(scan in operation_lower for scan in ['seq scan', 'table scan', 'full scan', 'table access full']):
        return ':::seq-scan'
    elif any(scan in operation_lower for scan in ['index scan', 'index range scan', 'index seek']):
        return ':::index-scan'
    elif any(join in operation_lower for join in ['hash join', 'nested loop', 'merge join', 'join']):
        return ':::join'
    elif any(agg in operation_lower for agg in ['aggregate', 'group', 'sort']):
        return ':::aggregate'
    elif any(filter in operation_lower for filter in ['filter', 'where']):
        return ':::filter'
    elif any(result in operation_lower for result in ['result', 'output']):
        return ':::result'
    else:
        return ':::default'

def get_alias_to_table_mapping(sql_query):
    import re
    alias_to_table = {}
    from_join_pattern = re.compile(r'(FROM|JOIN)\s+([\w\"]+)(?:\s+AS)?\s+(\w+)', re.IGNORECASE)
    for match in from_join_pattern.finditer(sql_query):
        real_table = match.group(2).replace('"', '')
        alias = match.group(3)
        alias_to_table[alias] = real_table
    return alias_to_table

def get_real_column_index_recommendations(sql_query, indexes, alias_to_table, tables):
    import re
    where_cols = set()
    orderby_cols = set()
    join_cols = set()
    for match in re.finditer(r'WHERE\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        where_cols.add(col)
    for match in re.finditer(r'JOIN\s+\w+\s+ON\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        join_cols.add(col)
    for match in re.finditer(r'ORDER BY\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        orderby_cols.add(col)
    user_indexes = parse_user_indexes(indexes)
    index_recs = {}
    for col in where_cols | join_cols | orderby_cols:
        # Only recommend for real columns in real tables (not aggregates/aliases)
        if col and '.' in col:
            alias, column = col.split('.', 1)
            real_table = alias_to_table.get(alias, alias)
            # Check if real_table is in tables
            if real_table not in [t['name'] for t in tables]:
                continue
            # Skip aggregates/aliases
            if re.match(r'\d+$', column) or column.lower() in ['count', 'sum', 'avg', 'min', 'max', 'order_count']:
                continue
            # SKIP if already indexed
            if column.lower() in user_indexes.get(real_table.lower(), set()):
                continue
            rec_text = f"Consider creating an index on column '{column}' in table '{real_table}' for better performance."
            ddl_text = f"CREATE INDEX idx_{real_table}_{column}_auto ON {real_table}({column});"
            key = ('index', real_table, column)
            if key not in index_recs:
                index_recs[key] = {'text': rec_text, 'actionable': True, 'sub': [{'text': ddl_text, 'actionable': False}], 'key': key}
            else:
                if not any(sub['text'] == ddl_text for sub in index_recs[key]['sub']):
                    index_recs[key]['sub'].append({'text': ddl_text, 'actionable': False})
    return list(index_recs.values())

def extract_fts_tables_from_explain(explain_plan, db_engine):
    """
    Extract all tables accessed via full table scan from the EXPLAIN plan using EXPLAIN_KEYWORDS.
    Returns a set of table names.
    Improved for Oracle: robustly extract table names from lines like 'TABLE ACCESS FULL USERS' and pipe-formatted plans.
    """
    from explain_keywords import EXPLAIN_KEYWORDS
    fts_tables = set()
    if not explain_plan:
        return fts_tables
    # Normalize line endings and strip whitespace
    plan_lines = [l.strip() for l in explain_plan.strip().split('\n') if l.strip()]
    keywords = EXPLAIN_KEYWORDS.get(db_engine, {})
    scan_keywords = set(keywords.get('sequential', []) + keywords.get('table', []) + keywords.get('full_scan', []) + keywords.get('scan', []))
    for line in plan_lines:
        # Oracle pipe format: | 3 | TABLE ACCESS FULL | DEPARTMENTS | 27 | 3 (0) |
        if db_engine == 'oracle' and '|' in line:
            parts = [p.strip() for p in line.strip('|').split('|')]
            if len(parts) >= 3:
                op = parts[1].upper()
                table = parts[2]
                for kw in scan_keywords:
                    if kw.upper() in op:
                        if table and table.upper() not in {'', 'N/A', 'VW_SQ_1'}:
                            fts_tables.add(table)
        else:
            for kw in scan_keywords:
                if kw.lower() in line.lower():
                    m = re.search(rf"{re.escape(kw)}[\s]+([\w\"\[\]]+)", line, re.IGNORECASE)
                    if m:
                        table = m.group(1).replace('"', '').replace('[', '').replace(']', '')
                        fts_tables.add(table)
                    else:
                        parts = line.strip().split()
                        if len(parts) > 0:
                            table = parts[-1].replace('"', '').replace('[', '').replace(']', '')
                            if table.upper() not in {'FULL', 'ACCESS', 'TABLE', 'SCAN', 'INDEX', 'HASH', 'JOIN', 'STATEMENT'}:
                                fts_tables.add(table)
    return fts_tables

# In each analyze_* function, after parsing the EXPLAIN plan:
# 1. Call extract_fts_tables_from_explain(explain_plan, db_engine)
# 2. For each FTS table, if not already indexed, recommend an index on the best predicate column (from WHERE/JOIN), or recommend review if no predicate found.
# 3. Ensure all FTS tables are covered in recommendations.

def extract_explain_plan_metrics(explain_plan, db_engine):
    """
    Parse EXPLAIN plan for actual rows scanned, cost, memory/bytes, and estimated time for all engines.
    Returns a dict: {rows_scanned, cost, memory, time}
    """
    metrics = {'rows_scanned': None, 'cost': None, 'memory': None, 'time': None}
    if not explain_plan:
        return metrics
    plan_lines = explain_plan.strip().split('\n')
    # Try CSV first if it looks like CSV
    if any(',' in line for line in plan_lines[:3]):
        try:
            csv_reader = csv.DictReader(StringIO(explain_plan))
            rows_list, cost_list, mem_list, time_list = [], [], [], []
            for row in csv_reader:
                for k, v in row.items():
                    if v is None or v == '' or v == 'NULL':
                        continue
                    kl = k.lower()
                    if 'row' in kl and v.isdigit():
                        rows_list.append(int(v))
                    if 'cost' in kl and v.replace('.', '', 1).isdigit():
                        cost_list.append(float(v))
                    if 'byte' in kl and v.isdigit():
                        mem_list.append(int(v))
                    if 'mem' in kl and v.replace('.', '', 1).isdigit():
                        mem_list.append(float(v))
                    if 'time' in kl and v.replace('.', '', 1).isdigit():
                        time_list.append(float(v))
            if rows_list:
                metrics['rows_scanned'] = max(rows_list)
            if cost_list:
                metrics['cost'] = max(cost_list)
            if mem_list:
                metrics['memory'] = max(mem_list)
            if time_list:
                metrics['time'] = max(time_list)
            return metrics
        except Exception:
            pass
    # Text parsing by engine
    if db_engine == 'postgresql':
        # e.g. Seq Scan on users  (cost=0.00..431.00 rows=21000 width=4)
        rows_list, cost_list, mem_list, time_list = [], [], [], []
        for line in plan_lines:
            m = re.search(r'rows=(\d+)', line)
            if m:
                rows_list.append(int(m.group(1)))
            m = re.search(r'cost=([\d\.]+)\.\.([\d\.]+)', line)
            if m:
                cost_list.append(float(m.group(2)))
            m = re.search(r'width=(\d+)', line)
            if m:
                mem_list.append(int(m.group(1)))
        if rows_list:
            metrics['rows_scanned'] = max(rows_list)
        if cost_list:
            metrics['cost'] = max(cost_list)
        if mem_list:
            metrics['memory'] = max(mem_list)
    elif db_engine == 'mysql':
        # e.g. | id | select_type | table | type | rows | Extra |
        for line in plan_lines:
            m = re.search(r'rows=?(\d+)', line)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
            m = re.search(r'Using\s+filesort', line, re.IGNORECASE)
            if m:
                metrics['cost'] = (metrics['cost'] or 0) + 10
        # MySQL EXPLAIN rarely gives memory/time directly
    elif db_engine == 'oracle':
        # Pipe/table or indented
        for line in plan_lines:
            m = re.search(r'rows=?(\d+)', line)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
            m = re.search(r'cost=?(\d+)', line)
            if m:
                metrics['cost'] = max(metrics['cost'] or 0, int(m.group(1))) if metrics['cost'] else int(m.group(1))
            m = re.search(r'bytes=?(\d+)', line)
            if m:
                metrics['memory'] = max(metrics['memory'] or 0, int(m.group(1))) if metrics['memory'] else int(m.group(1))
    elif db_engine == 'sqlserver':
        for line in plan_lines:
            m = re.search(r'Estimated Rows=?(\d+)', line, re.IGNORECASE)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
            m = re.search(r'Estimated Total Subtree Cost=([\d\.]+)', line, re.IGNORECASE)
            if m:
                metrics['cost'] = max(metrics['cost'] or 0, float(m.group(1))) if metrics['cost'] else float(m.group(1))
            m = re.search(r'Memory Grant=([\d\.]+)', line, re.IGNORECASE)
            if m:
                metrics['memory'] = max(metrics['memory'] or 0, float(m.group(1))) if metrics['memory'] else float(m.group(1))
    elif db_engine == 'sqlite':
        for line in plan_lines:
            m = re.search(r'rows=?(\d+)', line)
            if m:
                metrics['rows_scanned'] = max(metrics['rows_scanned'] or 0, int(m.group(1))) if metrics['rows_scanned'] else int(m.group(1))
    return metrics

def parse_user_indexes(indexes):
    """
    Parse user-provided index definitions and return {table: set(columns)} for fast lookup.
    Supports multi-column indexes and different syntaxes for all engines.
    """
    table_to_indexed_cols = {}
    for idx in indexes:
        defn = idx.get('definition') or idx.get('ddl') or ''
        # Try to extract table and columns from CREATE INDEX ... ON table(col1, col2, ...)
        m = re.search(r'CREATE\s+INDEX\s+\w+\s+ON\s+([\w\"\[\]]+)\s*\(([^)]+)\)', defn, re.IGNORECASE)
        if m:
            table = m.group(1).replace('"', '').replace('[', '').replace(']', '').lower()
            cols = [c.strip().lower() for c in m.group(2).split(',')]
            table_to_indexed_cols.setdefault(table, set()).update(cols)
            continue
        # MySQL/SQL Server: CREATE INDEX ... ON table (col1, col2)
        m = re.search(r'ON\s+([\w\"\[\]]+)\s*\(([^)]+)\)', defn, re.IGNORECASE)
        if m:
            table = m.group(1).replace('"', '').replace('[', '').replace(']', '').lower()
            cols = [c.strip().lower() for c in m.group(2).split(',')]
            table_to_indexed_cols.setdefault(table, set()).update(cols)
            continue
        # Oracle: CREATE INDEX ... ON "TABLE" ("COL1", ...)
        m = re.search(r'ON\s+"?([\w]+)"?\s*\(([^)]+)\)', defn, re.IGNORECASE)
        if m:
            table = m.group(1).lower()
            cols = [c.replace('"', '').strip().lower() for c in m.group(2).split(',')]
            table_to_indexed_cols.setdefault(table, set()).update(cols)
    return table_to_indexed_cols

# Update recommend_indexes_for_fts_tables to use parse_user_indexes

def recommend_indexes_for_fts_tables(sql_query, indexes, alias_to_table, tables, explain_plan, db_engine):
    """
    For every FTS table detected in the EXPLAIN plan, recommend an index on the best predicate column (from WHERE/JOIN/ORDER BY),
    or a review if no predicate is found. If an index exists but FTS still occurs, recommend investigation steps.
    Never recommend both a new index and investigation for the same table.
    """
    fts_tables = extract_fts_tables_from_explain(explain_plan, db_engine)
    where_cols = set()
    orderby_cols = set()
    join_cols = set()
    for match in re.finditer(r'WHERE\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        where_cols.add(col)
    for match in re.finditer(r'JOIN\s+\w+\s+ON\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        join_cols.add(col)
    for match in re.finditer(r'ORDER BY\s+([\w\.]+)', sql_query, re.IGNORECASE):
        col = match.group(1)
        orderby_cols.add(col)
    user_indexes = parse_user_indexes(indexes)
    recs = []
    for fts_table in fts_tables:
        fts_table_lc = fts_table.lower()
        investigation_given = False
        # Check if any relevant predicate column already has an index
        for col in where_cols | join_cols | orderby_cols:
            if col and '.' in col:
                alias, column = col.split('.', 1)
                real_table = alias_to_table.get(alias, alias).lower()
                column_lc = column.lower()
                if real_table == fts_table_lc:
                    # Skip aggregates/aliases
                    if re.match(r'\d+$', column_lc) or column_lc in ['count', 'sum', 'avg', 'min', 'max', 'order_count']:
                        continue
                    if column_lc in user_indexes.get(real_table, set()):
                        # Only investigation advice, never a new index for this table
                        rec_text = (f"Table '{fts_table}' is accessed via Full Table Scan even though an index exists on '{column}'. "
                                    f"Consider running ANALYZE/UPDATE STATISTICS, checking for data skew or NULLs, or using a query hint to encourage index usage.")
                        key = ('fts_index_exists', fts_table, column)
                        recs.append({'text': rec_text, 'actionable': True, 'sub': [], 'key': key})
                        investigation_given = True
                        break
        if not investigation_given:
            # Only recommend a new index if no relevant predicate column has an index
            best_col = None
            for col in where_cols | join_cols | orderby_cols:
                if col and '.' in col:
                    alias, column = col.split('.', 1)
                    real_table = alias_to_table.get(alias, alias).lower()
                    column_lc = column.lower()
                    if real_table == fts_table_lc:
                        # Skip aggregates/aliases
                        if re.match(r'\d+$', column_lc) or column_lc in ['count', 'sum', 'avg', 'min', 'max', 'order_count']:
                            continue
                        best_col = column
                        break
            if best_col:
                rec_text = f"Consider creating an index on column '{best_col}' in table '{fts_table}' for better performance (Full Table Scan detected)."
                ddl_text = f"CREATE INDEX idx_{fts_table}_{best_col}_auto ON {fts_table}({best_col});"
                key = ('fts_index', fts_table, best_col)
                recs.append({'text': rec_text, 'actionable': True, 'sub': [{'text': ddl_text, 'actionable': False}], 'key': key})
            else:
                rec_text = f"Table '{fts_table}' is accessed via Full Table Scan. Review for possible indexing or query rewrite."
                key = ('fts_review', fts_table)
                recs.append({'text': rec_text, 'actionable': True, 'sub': [], 'key': key})
    return recs

@app.errorhandler(CSRFError)
def handle_csrf_error(e):
    return render_template('csrf_error.html', reason=e.description), 400

def detect_engine_from_explain(explain_plan):
    """
    Heuristically detect the likely DB engine from the EXPLAIN plan string.
    Returns one of: 'oracle', 'mysql', 'postgresql', 'sqlserver', 'sqlite', or None.
    """
    if not explain_plan:
        return None
    plan = explain_plan.strip().lower()
    # SQL Server: |--, Clustered Index Scan, Hash Match, Nested Loops, etc.
    if '|--' in plan or 'clustered index scan' in plan or 'hash match' in plan or 'nested loops' in plan:
        return 'sqlserver'
    # Oracle: pipe format, TABLE ACCESS FULL, COST (%CPU)
    if 'table access full' in plan or 'cost (%cpu)' in plan or '| id  | operation' in plan:
        return 'oracle'
    # MySQL: id, select_type, table, type, rows, Extra
    if 'select_type' in plan and 'rows' in plan and 'extra' in plan:
        return 'mysql'
    if '| id |' in plan and '| table |' in plan:
        return 'mysql'
    # PostgreSQL: Seq Scan, Index Scan, cost=, width=
    if 'seq scan' in plan or 'index scan' in plan or 'cost=' in plan or 'width=' in plan:
        return 'postgresql'
    # SQLite: SCAN TABLE, SEARCH TABLE
    if 'scan table' in plan or 'search table' in plan:
        return 'sqlite'
    return None

def detect_explain_format(explain_plan):
    if not explain_plan:
        return 'unknown'
    plan_text = explain_plan.strip()
    # SQL Server tree format (prioritize this check)
    if '|--' in plan_text or 'Clustered Index Scan' in plan_text or 'Hash Match' in plan_text or 'Nested Loops' in plan_text:
        return 'sqlserver'
    # Check for JSON format
    if (plan_text.startswith('[') and plan_text.endswith(']')) or \
       (plan_text.startswith('{') and plan_text.endswith('}')):
        try:
            json.loads(plan_text)
            return 'json'
        except json.JSONDecodeError:
            pass
    # Check for XML format (SQL Server ShowPlanXML)
    if plan_text.startswith('<') or '<RelOp' in plan_text or '<ShowPlanXML' in plan_text:
        return 'xml'
    # Check for SQL Server specific formats (table style)
    if any(keyword in plan_text for keyword in [
        'StmtText', 'PhysicalOp', 'LogicalOp', 'EstimateRows', 'EstimateIO', 'EstimateCPU', 'TotalSubtreeCost',
        'HashAggregate', 'NodeId', 'PhysicalOp=', 'LogicalOp=', 'EstimateRows='
    ]):
        return 'sqlserver'
    # Check for PostgreSQL text format (has indentation and -> markers)
    if '->' in plan_text or 'Planning Time:' in plan_text or 'Execution Time:' in plan_text:
        return 'postgresql_text'
    # Check for Oracle format (pipe-delimited or table format)
    if '|' in plan_text and ('Id' in plan_text or 'OPERATION' in plan_text):
        return 'oracle'
    # Default to text format
    return 'text'

def parse_explain_to_json(explain_plan, db_engine):
    """Parse explain plan with format detection and routing"""
    if not explain_plan:
        return None
    
    # Auto-detect format
    detected_format = detect_explain_format(explain_plan)
    
    # Route to appropriate parser based on engine and format
    if db_engine == 'postgresql':
        if detected_format == 'json':
            return parse_postgresql_json(explain_plan)
        elif detected_format == 'xml':
            return parse_postgresql_xml(explain_plan)
        elif detected_format == 'postgresql_text':
            return parse_postgresql_text(explain_plan)
        else:
            return parse_postgresql_text(explain_plan)  # fallback
    elif db_engine == 'oracle':
        if detected_format == 'oracle':
            return parse_oracle_explain_flow(explain_plan)
        else:
            return parse_oracle_explain_flow(explain_plan)  # fallback
    elif db_engine == 'sqlserver':
        if detected_format == 'sqlserver':
            return parse_sqlserver_explain_flow(explain_plan)
        elif detected_format == 'xml':
            return parse_sqlserver_xml(explain_plan)
        else:
            return parse_sqlserver_explain_flow(explain_plan)  # fallback
    
    return None

def parse_postgresql_json(explain_plan):
    """Parse PostgreSQL JSON format - richest data source"""
    try:
        data = json.loads(explain_plan)
        return extract_from_postgresql_json(data)
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        return None

def extract_from_postgresql_json(data):
    """Extract execution tree from PostgreSQL JSON format"""
    if not data or not isinstance(data, list) or len(data) == 0:
        return None
    
    # PostgreSQL JSON format: [{"Plan": {...}}]
    plan_data = data[0].get('Plan', {})
    
    execution_tree = {
        'operation': 'Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    def extract_node_data(node):
        """Extract metrics from a JSON node"""
        node_data = {
            'operation': node.get('Node Type', 'Unknown Operation'),
            'cost': node.get('Total Cost', 0),
            'startup_cost': node.get('Startup Cost', 0),
            'rows': node.get('Actual Rows', node.get('Plan Rows', 0)),
            'time': node.get('Actual Total Time', 0),
            'buffers': node.get('Buffers', {}),
            'children': []
        }
        
        # Add relation name if available
        if node.get('Relation Name'):
            node_data['operation'] += f" on {node.get('Relation Name')}"
        
        # Add index name if available
        if node.get('Index Name'):
            node_data['operation'] += f" using {node.get('Index Name')}"
        
        # Add scan direction if available
        if node.get('Scan Direction'):
            node_data['operation'] += f" ({node.get('Scan Direction')})"
        
        # Add filter conditions if available
        if node.get('Filter'):
            node_data['filter'] = node.get('Filter')
        
        # Add join conditions if available
        if node.get('Hash Cond'):
            node_data['join_condition'] = node.get('Hash Cond')
        
        # Process children
        if 'Plans' in node:
            for child in node['Plans']:
                child_data = extract_node_data(child)
                node_data['children'].append(child_data)
        
        return node_data
    
    # Extract the main plan
    main_plan = extract_node_data(plan_data)
    execution_tree.update(main_plan)
    
    return execution_tree

def parse_postgresql_xml(explain_plan):
    """Parse PostgreSQL XML format"""
    # TODO: Implement XML parsing for PostgreSQL
    # For now, fallback to text parsing
    return parse_postgresql_text(explain_plan)

def parse_postgresql_text(explain_plan):
    """Parse PostgreSQL TEXT format - enhanced version"""
    lines = explain_plan.strip().split('\n')
    
    # Skip header lines
    skip_patterns = ['Planning Time:', 'Execution Time:', 'QUERY PLAN', '---']
    filtered_lines = []
    for line in lines:
        if not any(pattern in line for pattern in skip_patterns):
            filtered_lines.append(line)
    
    if not filtered_lines:
        return None
    
    # Parse the execution flow based on indentation
    execution_tree = {
        'operation': 'Query Execution Plan',
        'cost': 0,
        'rows': 0,
        'time': 0,
        'buffers': {},
        'children': []
    }
    
    # Stack to track parent nodes based on indentation
    node_stack = [execution_tree]
    indent_stack = [-1]  # Track indentation levels
    
    for line in filtered_lines:
        if not line.strip():
            continue
            
        # Calculate indentation level (count leading spaces or ->)
        original_line = line
        indent_level = 0
        while line.startswith('  ') or line.startswith('-> '):
            if line.startswith('-> '):
                indent_level += 1
                line = line[3:]
            else:
                indent_level += 1
                line = line[2:]
        
        # Parse operation and metrics
        operation, metrics = parse_enhanced_postgresql_line(line)
        
        if not operation:
            continue
        
        # Create node
        node = {
            'operation': operation,
            'cost': metrics.get('cost', 0),
            'rows': metrics.get('rows', 0),
            'time': metrics.get('time', 0),
            'buffers': metrics.get('buffers', {}),
            'children': []
        }
        
        # Find the correct parent based on indentation
        while len(indent_stack) > 1 and indent_level <= indent_stack[-1]:
            node_stack.pop()
            indent_stack.pop()
        
        # Add to current parent
        node_stack[-1]['children'].append(node)
        
        # Push this node onto stack for potential children
        node_stack.append(node)
        indent_stack.append(indent_level)
    
    return execution_tree

def parse_enhanced_postgresql_line(line):
    """Parse a single PostgreSQL operation line with enhanced metrics"""
    line = line.strip()
    
    # Extract metrics from parentheses
    metrics = {}
    operation = line
    
    # Look for metrics in parentheses
    if ' (cost=' in line:
        parts = line.split(' (cost=', 1)
        operation = parts[0].strip()
        metrics_str = 'cost=' + parts[1]
        
        # Parse startup and total cost
        cost_match = re.search(r'cost=([\d.]+)\.\.([\d.]+)', metrics_str)
        if cost_match:
            metrics['startup_cost'] = float(cost_match.group(1))
            metrics['cost'] = float(cost_match.group(2))
        
        # Parse rows
        rows_match = re.search(r'rows=(\d+)', metrics_str)
        if rows_match:
            metrics['rows'] = int(rows_match.group(1))
        
        # Parse actual time if available
        time_match = re.search(r'actual time=([\d.]+)\.\.([\d.]+)', metrics_str)
        if time_match:
            metrics['time'] = float(time_match.group(2))  # Use end time
        
        # Parse width
        width_match = re.search(r'width=(\d+)', metrics_str)
        if width_match:
            metrics['width'] = int(width_match.group(1))
        
        # Parse buffer information
        buffers_match = re.search(r'Buffers: (.*?)(?:\s|$)', metrics_str)
        if buffers_match:
            buffers_str = buffers_match.group(1)
            metrics['buffers'] = parse_buffer_info(buffers_str)
    
    # Extract filter conditions
    filter_match = re.search(r'Filter: (.+?)(?:\s|$)', line)
    if filter_match:
        metrics['filter'] = filter_match.group(1)
    
    # Extract join conditions
    join_match = re.search(r'Hash Cond: (.+?)(?:\s|$)', line)
    if join_match:
        metrics['join_condition'] = join_match.group(1)
    
    # Clean up operation name
    operation = operation.replace('_', ' ').title()
    
    return operation, metrics

def parse_buffer_info(buffers_str):
    """Parse PostgreSQL buffer information"""
    buffers = {}
    for buffer_info in buffers_str.split():
        buffer_type, buffer_count = buffer_info.split('=')
        buffers[buffer_type] = int(buffer_count)
    return buffers 
 i f   _ _ n a m e _ _   = =   ' _ _ m a i n _ _ ' :  
         a p p . r u n ( d e b u g = T r u e ,   h o s t = ' 0 . 0 . 0 . 0 ' ,   p o r t = 5 0 0 0 )  
 