from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash, make_response, Response
from flask_wtf import FlaskForm
from wtforms import TextAreaField, SubmitField, SelectField
from wtforms.validators import DataRequired
from flask_wtf.csrf import CSRFProtect, CSRFError
import os
import json
import sqlparse
import re
from io import StringIO
import csv
import hashlib
import time

# Import AI service
try:
    from ai_service import ai_service
    AI_ENABLED = True
except ImportError:
    AI_ENABLED = False
    print("Warning: AI service not available. Install required dependencies.")

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change_this_secret_key')
csrf = CSRFProtect(app)

class SQLInputForm(FlaskForm):
    sql_query = TextAreaField('SQL Query', validators=[DataRequired()])
    db_engine = SelectField('Database Engine', choices=[
        ('postgresql', 'PostgreSQL'),
        ('mysql', 'MySQL'),
        ('sqlserver', 'SQL Server'),
        ('oracle', 'Oracle'),
        ('sqlite', 'SQLite')
    ])
    explain_plan = TextAreaField('EXPLAIN Plan')
    submit = SubmitField('Analyze Query')

@app.route('/')
def index():
    form = SQLInputForm()
    return render_template('index.html', form=form)

@app.route('/analytics_dashboard')
def analytics_dashboard():
    # Get analytics data from session
    analytics_data = session.get('analytics_data', {})
    return render_template('analytics.html', analytics_data=analytics_data)

@app.route('/compare_queries')
def compare_queries():
    # Get comparison data from session
    comparison_data = session.get('comparison_data', {})
    return render_template('compare.html', comparison_data=comparison_data)

@app.route('/help_page')
def help_page():
    return render_template('help.html')

@app.route('/validate_sql', methods=['POST'])
def validate_sql():
    try:
        data = request.get_json()
        sql = data.get('sql_query', '')
        db_engine = data.get('db_engine', '')

        if not sql or not db_engine:
            return jsonify({'is_valid': False, 'error': 'SQL query and database engine are required'}), 400

        # Parse SQL to check basic syntax
        try:
            parsed = sqlparse.parse(sql)
            if not parsed:
                return jsonify({'is_valid': False, 'error': 'Invalid SQL syntax'}), 400

            # Basic validation based on SQL structure
            stmt = parsed[0]
            
            # Check if it's a SELECT statement
            if stmt.get_type() != 'SELECT':
                return jsonify({'is_valid': False, 'error': 'Only SELECT statements are supported'}), 400

            # Check for basic clauses
            has_from = any(token.is_keyword and token.value.upper() == 'FROM' for token in stmt.tokens)
            if not has_from:
                return jsonify({'is_valid': False, 'error': 'Missing FROM clause'}), 400

            # Engine-specific validation
            if db_engine == 'postgresql':
                # Check for PostgreSQL-specific syntax
                if 'FOR UPDATE SKIP LOCKED' in sql.upper() and not sql.upper().endswith('FOR UPDATE SKIP LOCKED'):
                    return jsonify({'is_valid': False, 'error': 'FOR UPDATE SKIP LOCKED must be at the end of the query'}), 400
            
            elif db_engine == 'mysql':
                # Check for MySQL-specific syntax
                if 'STRAIGHT_JOIN' in sql.upper() and not re.search(r'SELECT\s+STRAIGHT_JOIN', sql.upper()):
                    return jsonify({'is_valid': False, 'error': 'STRAIGHT_JOIN must follow SELECT'}), 400
            
            elif db_engine == 'sqlserver':
                # Check for SQL Server-specific syntax
                if 'TOP' in sql.upper() and not re.search(r'SELECT\s+TOP\s+\d+', sql.upper()):
                    return jsonify({'is_valid': False, 'error': 'Invalid TOP clause syntax'}), 400
            
            elif db_engine == 'oracle':
                # Check for Oracle-specific syntax
                if 'ROWNUM' in sql.upper() and 'WHERE' not in sql.upper():
                    return jsonify({'is_valid': False, 'error': 'ROWNUM should be used in WHERE clause'}), 400

            return jsonify({'is_valid': True}), 200

        except Exception as e:
            return jsonify({'is_valid': False, 'error': str(e)}), 400

    except Exception as e:
        return jsonify({'is_valid': False, 'error': str(e)}), 500

@app.route('/validate_explain', methods=['POST'])
def validate_explain():
    try:
        data = request.get_json()
        explain = data.get('explain_plan', '')
        db_engine = data.get('db_engine', '')

        if not explain or not db_engine:
            return jsonify({'is_valid': False, 'error': 'EXPLAIN plan and database engine are required'}), 400

        # Basic validation based on engine
        if db_engine == 'postgresql':
            if not any(keyword in explain.upper() for keyword in ['EXPLAIN', 'QUERY PLAN']):
                return jsonify({'is_valid': False, 'error': 'Invalid PostgreSQL EXPLAIN plan format'}), 400
        
        elif db_engine == 'mysql':
            if not any(keyword in explain.upper() for keyword in ['ID', 'SELECT_TYPE', 'TABLE', 'TYPE', 'POSSIBLE_KEYS']):
                return jsonify({'is_valid': False, 'error': 'Invalid MySQL EXPLAIN plan format'}), 400
        
        elif db_engine == 'sqlserver':
            if not any(keyword in explain.upper() for keyword in ['QUERY PLAN', 'SCAN', 'SEEK', 'JOIN']):
                return jsonify({'is_valid': False, 'error': 'Invalid SQL Server execution plan format'}), 400
        
        elif db_engine == 'oracle':
            if not any(keyword in explain.upper() for keyword in ['PLAN_TABLE_OUTPUT', 'OPERATION', 'OBJECT_NAME']):
                return jsonify({'is_valid': False, 'error': 'Invalid Oracle EXPLAIN plan format'}), 400

        return jsonify({'is_valid': True}), 200

    except Exception as e:
        return jsonify({'is_valid': False, 'error': str(e)}), 500

@app.route('/parse_explain', methods=['POST'])
def parse_explain():
    try:
        data = request.get_json()
        explain = data.get('explain_plan', '')
        db_engine = data.get('db_engine', '')

        if not explain or not db_engine:
            return jsonify({'error': 'EXPLAIN plan and database engine are required'}), 400

        # Convert EXPLAIN plan to Mermaid flowchart based on engine
        mermaid_code = 'graph TD;\n'  # Force top-down direction

        if db_engine == 'postgresql':
            # Parse PostgreSQL EXPLAIN plan
            lines = explain.split('\n')
            node_id = 0
            stack = []
            
            for line in lines:
                if not line.strip():
                    continue
                
                # Calculate indentation level
                indent = len(line) - len(line.lstrip())
                level = indent // 2
                
                # Pop stack until we're at the right level
                while len(stack) > level:
                    stack.pop()
                
                # Extract node info
                node_text = line.strip()
                current_id = f'node{node_id}'
                
                # Add node
                mermaid_code += f'{current_id}["{node_text}"];\n'
                
                # Add edge from parent if exists
                if stack and level > 0:
                    mermaid_code += f'{stack[-1]}-->{current_id};\n'
                
                stack.append(current_id)
                node_id += 1

        elif db_engine == 'mysql':
            # Parse MySQL EXPLAIN plan
            lines = explain.split('\n')
            node_id = 0
            prev_id = None
            
            for line in lines:
                if not line.strip() or line.startswith('************************'):
                    continue
                
                # Extract node info
                parts = line.split()
                if len(parts) < 2:
                    continue
                
                node_text = ' '.join(parts)
                current_id = f'node{node_id}'
                
                # Add node
                mermaid_code += f'{current_id}["{node_text}"];\n'
                
                # Add edge from previous node
                if prev_id:
                    mermaid_code += f'{prev_id}-->{current_id};\n'
                
                prev_id = current_id
                node_id += 1

        elif db_engine == 'sqlserver':
            # Parse SQL Server execution plan
            lines = explain.split('\n')
            node_id = 0
            stack = []
            
            for line in lines:
                if not line.strip() or line.startswith('|--'):
                    continue
                
                # Calculate indentation level
                indent = len(line) - len(line.lstrip())
                level = indent // 4
                
                # Pop stack until we're at the right level
                while len(stack) > level:
                    stack.pop()
                
                # Extract node info
                node_text = line.strip()
                current_id = f'node{node_id}'
                
                # Add node
                mermaid_code += f'{current_id}["{node_text}"];\n'
                
                # Add edge from parent if exists
                if stack and level > 0:
                    mermaid_code += f'{stack[-1]}-->{current_id};\n'
                
                stack.append(current_id)
                node_id += 1

        elif db_engine == 'oracle':
            # Parse Oracle EXPLAIN plan
            lines = explain.split('\n')
            node_id = 0
            stack = []
            
            for line in lines:
                if not line.strip():
                    continue
                
                # Calculate indentation level
                indent = len(line) - len(line.lstrip())
                level = indent // 2
                
                # Pop stack until we're at the right level
                while len(stack) > level:
                    stack.pop()
                
                # Extract node info
                node_text = line.strip()
                current_id = f'node{node_id}'
                
                # Add node
                mermaid_code += f'{current_id}["{node_text}"];\n'
                
                # Add edge from parent if exists
                if stack and level > 0:
                    mermaid_code += f'{stack[-1]}-->{current_id};\n'
                
                stack.append(current_id)
                node_id += 1

        return jsonify({
            'mermaid_code': mermaid_code,
            'message': 'EXPLAIN plan parsed successfully'
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        # Get form data
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        sql_query = data.get('sql_query')
        db_engine = data.get('db_engine')
        explain_plan = data.get('explain_plan')
        tables = data.get('tables', [])
        indexes = data.get('indexes', [])

        if not sql_query or not db_engine or not explain_plan:
            return jsonify({'error': 'Missing required fields'}), 400

        # Validate SQL query
        try:
            parsed = sqlparse.parse(sql_query)
            if not parsed:
                return jsonify({'error': 'Invalid SQL syntax'}), 400

            # Basic validation based on SQL structure
            stmt = parsed[0]
            
            # Check if it's a SELECT statement
            if stmt.get_type() != 'SELECT':
                return jsonify({'error': 'Only SELECT statements are supported'}), 400

            # Check for basic clauses
            has_from = any(token.is_keyword and token.value.upper() == 'FROM' for token in stmt.tokens)
            if not has_from:
                return jsonify({'error': 'Missing FROM clause'}), 400

        except Exception as e:
            return jsonify({'error': f'SQL validation failed: {str(e)}'}), 400

        # Validate EXPLAIN plan
        if db_engine == 'postgresql':
            plan_upper = explain_plan.upper()
            if not (
                'EXPLAIN' in plan_upper or
                'QUERY PLAN' in plan_upper or
                'COST=' in plan_upper or
                'NODE TYPE' in plan_upper or
                explain_plan.strip().startswith('{') or
                explain_plan.strip().startswith('[') or
                explain_plan.strip().startswith('-')
            ):
                return jsonify({'error': 'Invalid PostgreSQL EXPLAIN plan format'}), 400
        
        elif db_engine == 'mysql':
            if not any(keyword in explain_plan.upper() for keyword in ['ID', 'SELECT_TYPE', 'TABLE', 'TYPE', 'POSSIBLE_KEYS']):
                return jsonify({'error': 'Invalid MySQL EXPLAIN plan format'}), 400
        
        elif db_engine == 'sqlserver':
            if not any(keyword in explain_plan.upper() for keyword in ['QUERY PLAN', 'SCAN', 'SEEK', 'JOIN']):
                return jsonify({'error': 'Invalid SQL Server execution plan format'}), 400
        
        elif db_engine == 'oracle':
            if not any(keyword in explain_plan.upper() for keyword in ['PLAN_TABLE_OUTPUT', 'OPERATION', 'OBJECT_NAME']):
                return jsonify({'error': 'Invalid Oracle EXPLAIN plan format'}), 400

        # Store analysis data in session
        session['analysis_data'] = {
            'sql_query': sql_query,
            'db_engine': db_engine,
            'explain_plan': explain_plan,
            'tables': tables,
            'indexes': indexes,
            'timestamp': time.time()
        }

        # Update analytics data
        analytics_data = session.get('analytics_data', {})
        analytics_data.setdefault('queries_analyzed', 0)
        analytics_data['queries_analyzed'] += 1
        analytics_data.setdefault('engines', {})
        analytics_data['engines'][db_engine] = analytics_data['engines'].get(db_engine, 0) + 1
        session['analytics_data'] = analytics_data

        # Generate unique ID for sharing
        share_id = hashlib.sha256(f"{sql_query}{db_engine}{time.time()}".encode()).hexdigest()[:12]
        session[f'shared_{share_id}'] = session['analysis_data']

        return jsonify({'redirect': url_for('result', share_id=share_id)}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/result/<share_id>')
def result(share_id):
    # Get analysis data from session
    analysis_data = session.get(f'shared_{share_id}')
    if not analysis_data:
        flash('Analysis not found or expired', 'error')
        return redirect(url_for('index'))
    return render_template('result.html', analysis_data=analysis_data, share_id=share_id)

@app.route('/shared_result/<share_id>')
def shared_result(share_id):
    # Get analysis data from session
    analysis_data = session.get(f'shared_{share_id}')
    if not analysis_data:
        flash('Shared analysis not found or expired', 'error')
        return redirect(url_for('index'))
    return render_template('shared_result.html', analysis_data=analysis_data)

@app.route('/clear_history', methods=['POST'])
def clear_history():
    try:
        # Clear all analysis data from session
        keys_to_remove = []
        for key in session:
            if key.startswith('shared_') or key in ['analysis_data', 'analytics_data', 'comparison_data']:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            session.pop(key, None)

        return jsonify({'message': 'History cleared successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download_report/<share_id>/<format>')
def download_report(share_id, format):
    try:
        # Get analysis data
        analysis_data = session.get(f'shared_{share_id}')
        if not analysis_data:
            return jsonify({'error': 'Analysis not found or expired'}), 404

        if format == 'pdf':
            # Generate PDF report
            # This would require a PDF generation library like WeasyPrint or pdfkit
            return jsonify({'error': 'PDF export not implemented yet'}), 501

        elif format == 'csv':
            # Generate CSV report
            output = StringIO()
            writer = csv.writer(output)
            writer.writerow(['SQL Query', 'Database Engine', 'EXPLAIN Plan'])
            writer.writerow([
                analysis_data['sql_query'],
                analysis_data['db_engine'],
                analysis_data['explain_plan']
            ])
            
            # Write tables
            writer.writerow([])
            writer.writerow(['Tables'])
            writer.writerow(['Name', 'DDL', 'Row Count'])
            for table in analysis_data.get('tables', []):
                writer.writerow([table['name'], table['ddl'], table['rows']])
            
            # Write indexes
            writer.writerow([])
            writer.writerow(['Indexes'])
            writer.writerow(['Name', 'Table', 'Definition'])
            for index in analysis_data.get('indexes', []):
                writer.writerow([index['name'], index['table'], index['definition']])
            
            output.seek(0)
            return Response(
                output.getvalue(),
                mimetype='text/csv',
                headers={'Content-Disposition': f'attachment;filename=analysis_{share_id}.csv'}
            )

        elif format == 'markdown':
            # Generate Markdown report
            markdown = f"""# SQL Query Analysis Report

## Query Details
- **Database Engine**: {analysis_data['db_engine']}
- **Timestamp**: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(analysis_data['timestamp']))}

## SQL Query
```sql
{analysis_data['sql_query']}
```

## EXPLAIN Plan
```
{analysis_data['explain_plan']}
```

## Tables
| Name | Row Count | DDL |
|------|-----------|-----|
"""
            for table in analysis_data.get('tables', []):
                markdown += f"| {table['name']} | {table['rows']} | `{table['ddl']}` |\n"

            markdown += "\n## Indexes\n| Name | Table | Definition |\n|------|-------|------------|\n"
            for index in analysis_data.get('indexes', []):
                markdown += f"| {index['name']} | {index['table']} | `{index['definition']}` |\n"

            return Response(
                markdown,
                mimetype='text/markdown',
                headers={'Content-Disposition': f'attachment;filename=analysis_{share_id}.md'}
            )

        else:
            return jsonify({'error': 'Invalid export format'}), 400

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/ai_insight', methods=['POST'])
def ai_insight():
    """Get AI-powered insight for analysis"""
    if not AI_ENABLED:
        return jsonify({'error': 'AI service not available'}), 503
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        prompt_type = data.get('prompt_type')
        share_id = data.get('share_id')
        
        if not prompt_type or not share_id:
            return jsonify({'error': 'Missing prompt_type or share_id'}), 400
        
        # Get analysis data from session
        analysis_data = session.get(f'shared_{share_id}')
        if not analysis_data:
            return jsonify({'error': 'Analysis not found or expired'}), 404
        
        # Get AI insight
        result = ai_service.get_ai_insight(prompt_type, analysis_data)
        
        if result.get('success'):
            # Store AI response in session for later access
            ai_responses = session.get('ai_responses', {})
            ai_responses[f'{share_id}_{prompt_type}'] = result
            session['ai_responses'] = ai_responses
            
            return jsonify(result), 200
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({'error': f'AI insight error: {str(e)}'}), 500

@app.route('/ai_prompts', methods=['GET'])
def get_ai_prompts():
    """Get available AI prompt types"""
    if not AI_ENABLED:
        return jsonify({'error': 'AI service not available'}), 503
    
    try:
        prompts = ai_service.get_available_prompts()
        return jsonify({'prompts': prompts}), 200
    except Exception as e:
        return jsonify({'error': f'Error getting prompts: {str(e)}'}), 500

@app.route('/ai_insight/<share_id>/<prompt_type>')
def view_ai_insight(share_id, prompt_type):
    """View AI insight page"""
    if not AI_ENABLED:
        flash('AI service not available', 'error')
        return redirect(url_for('result', share_id=share_id))
    
    try:
        # Get analysis data
        analysis_data = session.get(f'shared_{share_id}')
        if not analysis_data:
            flash('Analysis not found or expired', 'error')
            return redirect(url_for('index'))
        
        # Get AI response from session or generate new one
        ai_responses = session.get('ai_responses', {})
        ai_response_key = f'{share_id}_{prompt_type}'
        
        if ai_response_key in ai_responses:
            ai_result = ai_responses[ai_response_key]
        else:
            # Generate new AI insight
            ai_result = ai_service.get_ai_insight(prompt_type, analysis_data)
            if ai_result.get('success'):
                ai_responses[ai_response_key] = ai_result
                session['ai_responses'] = ai_responses
        
        return render_template('ai_insight.html', 
                             analysis_data=analysis_data,
                             ai_result=ai_result,
                             share_id=share_id,
                             prompt_type=prompt_type)
                             
    except Exception as e:
        flash(f'Error loading AI insight: {str(e)}', 'error')
        return redirect(url_for('result', share_id=share_id))

@app.errorhandler(CSRFError)
def handle_csrf_error(e):
    return render_template('csrf_error.html'), 400

if __name__ == '__main__':
    app.run(debug=True) 