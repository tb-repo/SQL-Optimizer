from flask import Flask, render_template, request, redirect, url_for, flash, session, make_response, Response, jsonify
from flask_wtf import FlaskForm
from wtforms import TextAreaField, SubmitField, SelectField
from wtforms.validators import DataRequired
from flask_wtf.csrf import CSRFProtect
import os
import csv
import json
import hashlib
import time
from io import StringIO

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
        ('mysql', 'MySQL'),
        ('postgresql', 'PostgreSQL'),
        ('sqlserver', 'SQL Server'),
        ('oracle', 'Oracle'),
        ('sqlite', 'SQLite')
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
    if db_engine == 'mysql':
        return analyze_mysql(sql_query, tables, indexes, explain_plan)
    elif db_engine == 'postgresql':
        return analyze_postgresql(sql_query, tables, indexes, explain_plan)
    elif db_engine == 'sqlserver':
        return analyze_sqlserver(sql_query, tables, indexes, explain_plan)
    elif db_engine == 'oracle':
        return analyze_oracle(sql_query, tables, indexes, explain_plan)
    elif db_engine == 'sqlite':
        return analyze_sqlite(sql_query, tables, indexes, explain_plan)
    else:
        return analyze_generic(sql_query, tables, indexes, explain_plan)

def analyze_mysql(sql_query, tables, indexes, explain_plan=None):
    # Basic MySQL analysis
    recommendations = []
    warnings = []
    summary = []
    
    # Calculate performance score
    performance_score = calculate_performance_score(sql_query, tables, indexes, warnings, recommendations, explain_plan)
    
    # Calculate performance metrics
    performance_metrics = calculate_performance_metrics(sql_query, tables, indexes, 'mysql')
    
    return {
        'engine': 'MySQL',
        'summary': summary or ['MySQL-specific analysis will appear here.'],
        'recommendations': recommendations,
        'warnings': warnings,
        'optimized_query': None,
        'performance_score': performance_score,
        'performance_metrics': performance_metrics
    }

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

def calculate_performance_score(sql_query, tables, indexes, warnings, recommendations, explain_plan=None):
    """
    Calculate a performance score from 1-100 based on query analysis.
    Higher score = better performance.
    """
    score = 100  # Start with perfect score
    
    # Deduct points for various issues
    deductions = []
    
    # SELECT * penalty (major issue)
    if 'SELECT *' in sql_query.upper():
        score -= 15
        deductions.append("SELECT * usage (-15 points)")
    
    # Missing WHERE clause (major issue)
    if 'WHERE' not in sql_query.upper():
        score -= 20
        deductions.append("No WHERE clause (-20 points)")
    
    # JOIN without ON clause (major issue)
    if 'JOIN' in sql_query.upper() and 'ON' not in sql_query.upper():
        score -= 25
        deductions.append("JOIN without ON clause (-25 points)")
    
    # Warning penalties
    for warning in warnings:
        if 'SELECT *' in warning:
            continue  # Already counted
        elif 'WHERE clause' in warning:
            continue  # Already counted
        elif 'PRIMARY KEY' in warning:
            score -= 10
            deductions.append("Missing PRIMARY KEY (-10 points)")
        elif '100,000 rows' in warning:
            score -= 8
            deductions.append("Large table without optimization (-8 points)")
        elif '1GB' in warning or '10GB' in warning:
            score -= 12
            deductions.append("Large table size (-12 points)")
        elif 'Sequential Scan' in warning or 'Seq Scan' in warning:
            score -= 15
            deductions.append("Sequential scan detected (-15 points)")
        else:
            score -= 5
            deductions.append("General warning (-5 points)")
    
    # Missing indexes penalty
    missing_index_count = len([r for r in recommendations if 'index' in r.lower() and 'adding' in r.lower()])
    if missing_index_count > 0:
        score -= min(missing_index_count * 8, 20)  # Max 20 points for missing indexes
        deductions.append(f"Missing indexes (-{min(missing_index_count * 8, 20)} points)")
    
    # Large table penalties
    large_table_count = 0
    for table in tables:
        if table.get('rows'):
            try:
                if int(table['rows']) > 1000000:  # 1M+ rows
                    large_table_count += 1
            except:
                pass
    
    if large_table_count > 0:
        score -= min(large_table_count * 5, 15)
        deductions.append(f"Very large tables (-{min(large_table_count * 5, 15)} points)")
    
    # Bonus points for good practices
    bonuses = []
    
    # Has proper WHERE clause
    if 'WHERE' in sql_query.upper():
        score += 5
        bonuses.append("Proper WHERE clause (+5 points)")
    
    # Has indexes provided
    if len(indexes) > 0:
        score += 8
        bonuses.append("Indexes provided (+8 points)")
    
    # Has table information provided
    if len(tables) > 0:
        score += 5
        bonuses.append("Table information provided (+5 points)")
    
    # Bonus for primary keys
    primary_key_count = sum(1 for t in tables if t.get('has_primary_key') and t.get('primary_key_column'))
    if primary_key_count > 0:
        score += primary_key_count * 3
        bonuses.append(f"Primary keys defined (+{primary_key_count * 3} points)")
    
    # Bonus for foreign keys
    foreign_key_count = sum(1 for t in tables if t.get('has_foreign_key') and t.get('foreign_key_column'))
    if foreign_key_count > 0:
        score += foreign_key_count * 2
        bonuses.append(f"Foreign keys defined (+{foreign_key_count * 2} points)")
    
    # Has EXPLAIN plan
    if explain_plan:
        score += 3
        bonuses.append("EXPLAIN plan provided (+3 points)")
    
    # Specific column selection (not SELECT *)
    if 'SELECT' in sql_query.upper() and '*' not in sql_query.upper():
        score += 10
        bonuses.append("Specific column selection (+10 points)")
    
    # Ensure score stays within bounds
    score = max(1, min(100, score))
    
    # Determine performance level
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
    
    return {
        'score': score,
        'level': performance_level,
        'color': performance_color,
        'deductions': deductions,
        'bonuses': bonuses,
        'total_deductions': sum([int(d.split('(')[1].split()[0]) for d in deductions if '(' in d]),
        'total_bonuses': sum([int(b.split('(')[1].split()[0]) for b in bonuses if '(' in b])
    }

def calculate_performance_metrics(sql_query, tables, indexes, db_engine):
    """Calculate detailed performance metrics for the query"""
    metrics = {
        'estimated_execution_time': 'Unknown',
        'estimated_rows_scanned': 0,
        'estimated_memory_usage': 'Unknown',
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
        # Parse SQL to extract components
        sql_upper = sql_query.upper()
        
        # Calculate complexity score (1-100)
        complexity = 0
        
        # Base complexity
        complexity += 10
        
        # JOIN complexity
        join_count = sql_upper.count('JOIN')
        complexity += join_count * 15
        metrics['join_complexity'] = join_count
        
        # Aggregation complexity
        agg_functions = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'GROUP BY', 'HAVING']
        agg_count = sum(sql_upper.count(func) for func in agg_functions)
        complexity += agg_count * 8
        metrics['aggregation_complexity'] = agg_count
        
        # Subquery complexity
        subquery_count = sql_upper.count('SELECT') - 1  # Subtract main SELECT
        complexity += subquery_count * 20
        
        # Window function complexity
        window_count = sql_upper.count('OVER')
        complexity += window_count * 12
        
        # JSON complexity
        json_ops = ['->>', '->', 'JSONB_', 'JSON_']
        json_count = sum(sql_upper.count(op) for op in json_ops)
        complexity += json_count * 5
        
        # CTE complexity
        cte_count = sql_upper.count('WITH')
        complexity += cte_count * 10
        
        metrics['complexity_score'] = min(complexity, 100)
        
        # Estimate rows scanned based on tables
        total_rows = 0
        if tables:
            for table in tables:
                try:
                    rows_str = str(table.get('rows', '0'))
                    rows_str = rows_str.replace(',', '').replace('K', '000').replace('M', '000000').replace('B', '000000000')
                    rows = int(rows_str)
                    total_rows += rows
                except:
                    total_rows += 10000  # Default estimate
        
        metrics['estimated_rows_scanned'] = total_rows
        
        # Calculate index utilization
        index_count = len(indexes) if indexes else 0
        table_count = len(tables) if tables else 1
        metrics['index_utilization'] = min((index_count / table_count) * 100, 100)
        
        # Estimate execution time based on complexity and data size
        base_time = 0.1  # Base time in seconds
        
        # Time based on complexity
        time_multiplier = 1 + (complexity / 100)
        
        # Time based on data size
        if total_rows > 1000000:  # 1M+ rows
            time_multiplier *= 3
        elif total_rows > 100000:  # 100K+ rows
            time_multiplier *= 2
        elif total_rows > 10000:  # 10K+ rows
            time_multiplier *= 1.5
        
        # Time based on joins
        time_multiplier += join_count * 0.5
        
        # Time based on aggregations
        time_multiplier += agg_count * 0.3
        
        estimated_time = base_time * time_multiplier
        
        if estimated_time < 0.5:
            metrics['estimated_execution_time'] = f"{estimated_time:.2f}s"
        elif estimated_time < 60:
            metrics['estimated_execution_time'] = f"{estimated_time:.1f}s"
        else:
            metrics['estimated_execution_time'] = f"{estimated_time/60:.1f}min"
        
        # Estimate memory usage
        memory_mb = total_rows * 0.001  # Rough estimate: 1KB per row
        if memory_mb < 1:
            metrics['estimated_memory_usage'] = f"{memory_mb*1024:.0f}KB"
        elif memory_mb < 1024:
            metrics['estimated_memory_usage'] = f"{memory_mb:.1f}MB"
        else:
            metrics['estimated_memory_usage'] = f"{memory_mb/1024:.1f}GB"
        
        # Determine resource intensity
        if complexity > 80 or total_rows > 1000000:
            metrics['resource_intensity'] = 'Very High'
        elif complexity > 60 or total_rows > 100000:
            metrics['resource_intensity'] = 'High'
        elif complexity > 40 or total_rows > 10000:
            metrics['resource_intensity'] = 'Medium'
        else:
            metrics['resource_intensity'] = 'Low'
        
        # Calculate performance grade
        grade_score = 100
        grade_score -= complexity * 0.5
        grade_score -= join_count * 5
        grade_score += metrics['index_utilization'] * 0.3
        
        if grade_score >= 90:
            metrics['performance_grade'] = 'A'
        elif grade_score >= 80:
            metrics['performance_grade'] = 'B'
        elif grade_score >= 70:
            metrics['performance_grade'] = 'C'
        elif grade_score >= 60:
            metrics['performance_grade'] = 'D'
        else:
            metrics['performance_grade'] = 'F'
        
        # Calculate query efficiency
        efficiency = 100
        if 'SELECT *' in sql_upper:
            efficiency -= 20
        if 'WHERE' not in sql_upper:
            efficiency -= 30
        if join_count > 3:
            efficiency -= join_count * 5
        if agg_count > 2:
            efficiency -= agg_count * 3
        
        metrics['query_efficiency'] = max(efficiency, 0)
        
        # Determine data access pattern
        if 'INDEX' in sql_upper or metrics['index_utilization'] > 50:
            metrics['data_access_pattern'] = 'Indexed'
        elif 'SCAN' in sql_upper or total_rows > 100000:
            metrics['data_access_pattern'] = 'Full Scan'
        elif join_count > 0:
            metrics['data_access_pattern'] = 'Join-based'
        else:
            metrics['data_access_pattern'] = 'Simple'
        
        # Calculate optimization potential
        optimization = 0
        if metrics['index_utilization'] < 50:
            optimization += 30
        if 'SELECT *' in sql_upper:
            optimization += 20
        if 'WHERE' not in sql_upper:
            optimization += 25
        if join_count > 2:
            optimization += 15
        if complexity > 60:
            optimization += 10
        
        metrics['optimization_potential'] = min(optimization, 100)
        
        # Add database-specific adjustments
        if db_engine == 'postgresql':
            if 'JSONB' in sql_upper:
                time_str = metrics['estimated_execution_time']
                if 's' in time_str:
                    time_val = float(time_str.replace('s', ''))
                    metrics['estimated_execution_time'] = f"{time_val * 1.2:.2f}s"
                elif 'min' in time_str:
                    time_val = float(time_str.replace('min', ''))
                    metrics['estimated_execution_time'] = f"{time_val * 1.2:.1f}min"
        elif db_engine == 'mysql':
            if 'JSON' in sql_upper:
                time_str = metrics['estimated_execution_time']
                if 's' in time_str:
                    time_val = float(time_str.replace('s', ''))
                    metrics['estimated_execution_time'] = f"{time_val * 1.5:.2f}s"
                elif 'min' in time_str:
                    time_val = float(time_str.replace('min', ''))
                    metrics['estimated_execution_time'] = f"{time_val * 1.5:.1f}min"
        
    except Exception as e:
        # Fallback values if calculation fails
        metrics['estimated_execution_time'] = 'Unknown'
        metrics['complexity_score'] = 50
        metrics['performance_grade'] = 'C'
        metrics['query_efficiency'] = 50
        metrics['optimization_potential'] = 50
    
    return metrics

def analyze_postgresql(sql_query, tables, indexes, explain_plan=None):
    """
    Analyze a PostgreSQL query for performance issues using static analysis and best practices.
    Now uses sqlparse to provide line numbers and table names for JOIN issues.
    """
    import re
    import sqlparse
    recommendations = []
    warnings = []
    optimized_query = None
    summary = []
    explain_mermaid = None
    # JOIN/ON analysis (improved)
    lines = sql_query.splitlines()
    parsed = sqlparse.parse(sql_query)
    for stmt in parsed:
        tokens = list(stmt.flatten())
        join_indices = [i for i, t in enumerate(tokens) if t.match(sqlparse.tokens.Keyword, 'JOIN', regex=False)]
        for idx in join_indices:
            table_token = tokens[idx + 1] if idx + 1 < len(tokens) else None
            table_name = table_token.value if table_token and table_token.value.strip() else '(unknown)'
            join_text = ' '.join(t.value for t in tokens[max(0, idx-2):idx+3])
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
                if table_name != '(unknown)' or lineno != '?':
                    summary.append(warn_msg)
    # SELECT *
    if re.search(r'SELECT\s+\*', sql_query, re.IGNORECASE):
        warnings.append("Avoid using SELECT *. Specify only the columns you need for better performance and maintainability.")
        summary.append("Query uses SELECT *.")
    # WHERE clause
    if not re.search(r'WHERE\s', sql_query, re.IGNORECASE):
        warnings.append("Query does not have a WHERE clause. This may result in full table scans and poor performance on large tables.")
        summary.append("No WHERE clause detected.")
    # Check for missing indexes on WHERE columns
    where_cols = re.findall(r'WHERE\s+([\w\.]+)', sql_query, re.IGNORECASE)
    for col in where_cols:
        found = False
        for idx in indexes:
            if idx['definition'] and col in idx['definition']:
                found = True
                break
        if not found:
            summary.append(f"Possible missing index on {col}.")
            recommendations.append(f"Consider adding an index on column '{col}' used in WHERE clause for better performance.")
    # Check for primary key presence in each table
    for t in tables:
        if t.get('has_primary_key') and t.get('primary_key_column'):
            # Table has primary key defined
            primary_key_col = t['primary_key_column']
            recommendations.append(f"Table '{t['name']}' has primary key on '{primary_key_col}'. Ensure this column is used in WHERE clauses for optimal performance.")
        elif t['ddl'] and 'PRIMARY KEY' not in t['ddl'].upper():
            warnings.append(f"Table '{t['name']}' does not have a PRIMARY KEY. Every table should have a PRIMARY KEY for best performance and data integrity.")
        
        # Check for foreign key relationships
        if t.get('has_foreign_key') and t.get('foreign_key_column') and t.get('foreign_key_table'):
            foreign_key_col = t['foreign_key_column']
            foreign_table = t['foreign_key_table']
            recommendations.append(f"Table '{t['name']}' has foreign key '{foreign_key_col}' referencing '{foreign_table}'. Consider adding indexes on foreign key columns for better JOIN performance.")
            
            # Check if there's an index on the foreign key
            has_fk_index = False
            for idx in indexes:
                if idx['table'] == t['name'] and foreign_key_col in idx['definition']:
                    has_fk_index = True
                    break
            
            if not has_fk_index:
                recommendations.append(f"Add an index on foreign key column '{foreign_key_col}' in table '{t['name']}' for better JOIN performance with '{foreign_table}'.")
    # Large table scan risk
    for t in tables:
        if t['name'] and t['rows']:
            try:
                if int(t['rows']) > 100000:
                    warnings.append(f"Table {t['name']} has more than 100,000 rows. Ensure queries on this table are well-indexed and optimized.")
            except Exception:
                pass
    # Table size analysis (granular, flexible units)
    for t in tables:
        try:
            size_mb = parse_size_to_mb(t.get('size', 0) or 0)
            if size_mb > 10000:
                warnings.append(f"Table '{t['name']}' is larger than 10GB. Strongly consider partitioning and regular maintenance.")
                recommendations.append(f"Partition and regularly maintain table '{t['name']}' for optimal performance.")
                summary.append(f"Table '{t['name']}' exceeds 10GB and may impact performance.")
            elif size_mb > 1000:
                warnings.append(f"Table '{t['name']}' is larger than 1GB. Consider partitioning or archiving old data.")
                recommendations.append(f"Partition or archive data in table '{t['name']}' to improve performance.")
                summary.append(f"Table '{t['name']}' exceeds 1GB and may impact performance.")
        except Exception:
            pass
    # Index size analysis (granular, flexible units)
    for idx in indexes:
        try:
            size_mb = parse_size_to_mb(idx.get('size', 0) or 0)
            if size_mb > 2000:
                warnings.append(f"Index '{idx['name']}' on table '{idx['table']}' is larger than 2GB. Review index usage and necessity.")
                recommendations.append(f"Drop unused or redundant indexes on '{idx['table']}'.")
                summary.append(f"Index '{idx['name']}' exceeds 2GB and may impact performance.")
            elif size_mb > 500:
                warnings.append(f"Index '{idx['name']}' on table '{idx['table']}' is larger than 500MB. Consider index compression or partitioning.")
                recommendations.append(f"Consider compressing or partitioning index '{idx['name']}' on table '{idx['table']}'.")
                summary.append(f"Index '{idx['name']}' exceeds 500MB and may impact performance.")
        except Exception:
            pass
    # EXPLAIN plan analysis
    if explain_plan:
        for t in tables:
            if t['name'] and t['name'] in explain_plan and 'Seq Scan' in explain_plan:
                warn_msg = f"EXPLAIN plan shows a Sequential Scan on table '{t['name']}'. Consider adding indexes or rewriting the query to enable index usage."
                warnings.append(warn_msg)
                summary.append(f"Sequential Scan detected in EXPLAIN plan for table {t['name']}.")
                for col in where_cols:
                    if t['name'] in col:
                        recommendations.append(f"For table '{t['name']}', consider adding an index on column '{col.split('.')[-1]}' to avoid sequential scan.")
            if t['name'] and t['name'] in explain_plan and 'Index Scan' in explain_plan:
                recommendations.append(f"EXPLAIN plan shows Index Scan on table '{t['name']}'. This is generally good, but ensure the right index is being used.")
                summary.append(f"Index Scan detected in EXPLAIN plan for table {t['name']}.")
            if t['name'] and t['name'] in explain_plan and ('Bitmap Heap Scan' in explain_plan or 'Bitmap Index Scan' in explain_plan):
                recommendations.append(f"Bitmap scans on table '{t['name']}' can be efficient for some queries, but may indicate missing composite indexes.")
                summary.append(f"Bitmap Scan detected in EXPLAIN plan for table {t['name']}.")
    recommendations.append("Use EXPLAIN (ANALYZE, BUFFERS) before your query to see the actual execution plan and identify bottlenecks.")
    if re.search(r'SELECT\s+\*', sql_query, re.IGNORECASE):
        optimized_query = re.sub(r'SELECT\s+\*', 'SELECT <columns>', sql_query, flags=re.IGNORECASE)
    # Deduplicate recommendations, warnings, and summary
    recommendations = list(dict.fromkeys(recommendations))
    warnings = list(dict.fromkeys(warnings))
    summary = list(dict.fromkeys(summary))
    
    # Calculate performance score
    performance_score = calculate_performance_score(sql_query, tables, indexes, warnings, recommendations, explain_plan)
    
    # Calculate performance metrics
    performance_metrics = calculate_performance_metrics(sql_query, tables, indexes, 'postgresql')
    
    return {
        'engine': 'PostgreSQL',
        'summary': summary,
        'recommendations': recommendations,
        'warnings': warnings,
        'optimized_query': optimized_query,
        'explain_mermaid': explain_mermaid,
        'performance_score': performance_score,
        'performance_metrics': performance_metrics
    }

def analyze_sqlserver(sql_query, tables, indexes, explain_plan=None):
    # Basic SQL Server analysis
    recommendations = []
    warnings = []
    summary = []
    
    # Calculate performance score
    performance_score = calculate_performance_score(sql_query, tables, indexes, warnings, recommendations, explain_plan)
    
    # Calculate performance metrics
    performance_metrics = calculate_performance_metrics(sql_query, tables, indexes, 'sqlserver')
    
    return {
        'engine': 'SQL Server',
        'summary': summary or ['SQL Server-specific analysis will appear here.'],
        'recommendations': recommendations,
        'warnings': warnings,
        'optimized_query': None,
        'performance_score': performance_score,
        'performance_metrics': performance_metrics
    }

def analyze_oracle(sql_query, tables, indexes, explain_plan=None):
    recommendations = []
    warnings = []
    optimized_query = None
    summary = []
    explain_mermaid = None
    import re
    # Table size analysis (granular, flexible units)
    for t in tables:
        try:
            size_mb = parse_size_to_mb(t.get('size', 0) or 0)
            if size_mb > 10000:
                warnings.append(f"Table '{t['name']}' is larger than 10GB. Strongly consider partitioning and regular maintenance.")
                recommendations.append(f"Partition and regularly maintain table '{t['name']}' for optimal performance.")
                summary.append(f"Table '{t['name']}' exceeds 10GB and may impact performance.")
            elif size_mb > 1000:
                warnings.append(f"Table '{t['name']}' is larger than 1GB. Consider partitioning or archiving old data.")
                recommendations.append(f"Partition or archive data in table '{t['name']}' to improve performance.")
                summary.append(f"Table '{t['name']}' exceeds 1GB and may impact performance.")
        except Exception:
            pass
    # Index size analysis (granular, flexible units)
    for idx in indexes:
        try:
            size_mb = parse_size_to_mb(idx.get('size', 0) or 0)
            if size_mb > 2000:
                warnings.append(f"Index '{idx['name']}' on table '{idx['table']}' is larger than 2GB. Review index usage and necessity.")
                recommendations.append(f"Drop unused or redundant indexes on '{idx['table']}'.")
                summary.append(f"Index '{idx['name']}' exceeds 2GB and may impact performance.")
            elif size_mb > 500:
                warnings.append(f"Index '{idx['name']}' on table '{idx['table']}' is larger than 500MB. Consider index compression or partitioning.")
                recommendations.append(f"Consider compressing or partitioning index '{idx['name']}' on table '{idx['table']}'.")
                summary.append(f"Index '{idx['name']}' exceeds 500MB and may impact performance.")
        except Exception:
            pass
    # Oracle EXPLAIN PLAN parsing (simple)
    if explain_plan:
        lines = [l for l in explain_plan.splitlines() if '|' in l and not l.strip().startswith('-') and not l.strip().startswith('Id')]
        nodes = []
        edges = []
        id_to_node = {}
        parent_stack = []
        prev_indent = 0
        for i, line in enumerate(lines):
            parts = [p.strip() for p in line.strip('|').split('|')]
            if len(parts) < 3:
                continue
            node_id = parts[0].replace('*','').strip()
            operation = parts[1]
            name = parts[2]
            label = f"{operation} {name}".strip()
            node_name = f"N{node_id}"
            nodes.append(f'{node_name}["{label}"]')
            id_to_node[node_id] = node_name
            # Detect parent by indentation (simple fallback)
            indent = len(line) - len(line.lstrip())
            if i > 0 and indent > prev_indent:
                parent_stack.append(last_node_id)
            elif i > 0 and indent < prev_indent and parent_stack:
                parent_stack.pop()
            if parent_stack:
                edges.append(f'{id_to_node[parent_stack[-1]]} --> {node_name}')
            prev_indent = indent
            last_node_id = node_id
            # Recommendations
            if 'TABLE ACCESS FULL' in operation.upper():
                warnings.append(f"Full table scan detected on {name}. Consider adding an index or rewriting the query.")
                summary.append(f"Full table scan on {name}.")
            if 'INDEX RANGE SCAN' in operation.upper():
                recommendations.append(f"Index range scan used on {name}. This is efficient if the right index is chosen.")
                summary.append(f"Index range scan on {name}.")
        if nodes:
            explain_mermaid = 'graph TD\n' + '\n'.join(nodes + edges)
    recommendations.append("Use EXPLAIN PLAN FOR ... and DBMS_XPLAN.DISPLAY to review Oracle execution plans.")
    recommendations = list(dict.fromkeys(recommendations))
    warnings = list(dict.fromkeys(warnings))
    summary = list(dict.fromkeys(summary))
    
    # Calculate performance score
    performance_score = calculate_performance_score(sql_query, tables, indexes, warnings, recommendations, explain_plan)
    
    # Calculate performance metrics
    performance_metrics = calculate_performance_metrics(sql_query, tables, indexes, 'oracle')
    
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

def analyze_sqlite(sql_query, tables, indexes, explain_plan=None):
    # Basic SQLite analysis
    recommendations = []
    warnings = []
    summary = []
    
    # Calculate performance score
    performance_score = calculate_performance_score(sql_query, tables, indexes, warnings, recommendations, explain_plan)
    
    # Calculate performance metrics
    performance_metrics = calculate_performance_metrics(sql_query, tables, indexes, 'sqlite')
    
    return {
        'engine': 'SQLite',
        'summary': summary or ['SQLite-specific analysis will appear here.'],
        'recommendations': recommendations,
        'warnings': warnings,
        'optimized_query': None,
        'performance_score': performance_score,
        'performance_metrics': performance_metrics
    }

def analyze_generic(sql_query, tables, indexes, explain_plan=None):
    # Basic generic analysis
    recommendations = []
    warnings = []
    summary = []
    
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
            return render_template('index.html', form=form, tables=tables, indexes=indexes)
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
    print('DEBUG: session["history"] =', history)  # Debug print
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
            recommendations.append(f"{', '.join(well_opt_queries)} {'is' if len(well_optimized) == 1 else 'are'} well-optimized (≤25% improvement potential).")
        
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
    import sqlparse
    print('--- /beautify_sql endpoint called ---')
    print('Headers:', dict(request.headers))
    print('Data:', request.data)
    try:
        data = request.get_json(force=True, silent=False)
        print('Parsed JSON:', data)
        sql = data.get('sql', '') if data else ''
        formatted = sqlparse.format(sql, reindent=True, keyword_case='upper')
        return jsonify({'beautified': formatted})
    except Exception as e:
        print('Error:', e)
        return jsonify({'error': 'Invalid request or JSON: ' + str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True) 