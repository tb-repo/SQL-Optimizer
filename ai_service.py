import os
import json
import requests
from typing import Dict, List, Optional, Any
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIService:
    """AI Service for SQL Query Analysis with pre-defined prompts"""
    
    def __init__(self):
        # You can configure these based on your AI provider
        self.api_key = os.environ.get('AI_API_KEY', 'your-api-key-here')
        self.api_url = os.environ.get('AI_API_URL', 'https://api.openai.com/v1/chat/completions')
        self.model = os.environ.get('AI_MODEL', 'gpt-3.5-turbo')
        self.max_tokens = int(os.environ.get('AI_MAX_TOKENS', '1000'))
        
        # Pre-defined prompts for different analysis types
        self.prompts = {
            'why_slow': {
                'title': 'Why is this SQL slow?',
                'prompt': """You are a senior database performance expert. Analyze this SQL query and EXPLAIN plan to identify why it might be slow.

SQL Query:
{sql_query}

Database Engine: {db_engine}

EXPLAIN Plan:
{explain_plan}

Table Information:
{tables_info}

Index Information:
{indexes_info}

Current Analysis:
{current_analysis}

Please explain in simple terms why this query might be slow, focusing on:
1. The most likely performance bottlenecks
2. What the EXPLAIN plan reveals about execution
3. Specific issues that could be causing slowness
4. Quick wins for improvement

Keep your response conversational and easy to understand."""
            },
            
            'optimize_query': {
                'title': 'How can this query be optimized?',
                'prompt': """You are a database optimization expert. Provide specific, actionable recommendations to optimize this SQL query.

SQL Query:
{sql_query}

Database Engine: {db_engine}

EXPLAIN Plan:
{explain_plan}

Table Information:
{tables_info}

Index Information:
{indexes_info}

Current Analysis:
{current_analysis}

Please provide optimization recommendations focusing on:
1. Query structure improvements
2. Index suggestions
3. Database engine-specific optimizations
4. Alternative query approaches
5. Performance impact estimates

Make your recommendations practical and implementable."""
            },
            
            'explain_simple': {
                'title': 'Explain this plan like I\'m 5',
                'prompt': """You are a patient teacher explaining database concepts to a beginner. Explain this SQL query and execution plan in very simple terms.

SQL Query:
{sql_query}

Database Engine: {db_engine}

EXPLAIN Plan:
{explain_plan}

Please explain:
1. What this query is trying to do (in simple terms)
2. How the database will execute it (step by step)
3. What the EXPLAIN plan tells us about performance
4. Any potential issues in simple language

Use analogies and simple language. Avoid technical jargon unless necessary, and explain any technical terms you do use."""
            },
            
            'index_recommendations': {
                'title': 'What indexes should I create?',
                'prompt': """You are a database indexing expert. Analyze this query and suggest specific indexes to improve performance.

SQL Query:
{sql_query}

Database Engine: {db_engine}

EXPLAIN Plan:
{explain_plan}

Current Tables:
{tables_info}

Current Indexes:
{indexes_info}

Please suggest:
1. Specific indexes to create (with CREATE INDEX statements)
2. Which columns to include in each index
3. Index order and selectivity considerations
4. Expected performance improvements
5. Any indexes that might be redundant

Focus on the most impactful indexes first."""
            },
            
            'performance_breakdown': {
                'title': 'Break down the performance issues',
                'prompt': """You are a database performance analyst. Provide a detailed breakdown of performance issues in this query.

SQL Query:
{sql_query}

Database Engine: {db_engine}

EXPLAIN Plan:
{explain_plan}

Table Information:
{tables_info}

Index Information:
{indexes_info}

Please provide:
1. A detailed analysis of each step in the execution plan
2. Identification of the most expensive operations
3. Root cause analysis of performance issues
4. Specific metrics and their implications
5. Prioritized list of performance problems

Be thorough but keep it accessible to database professionals."""
            }
        }
    
    def _call_ai_api(self, prompt: str) -> Optional[str]:
        """Make API call to AI service"""
        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'model': self.model,
                'messages': [
                    {'role': 'system', 'content': 'You are a helpful database performance expert.'},
                    {'role': 'user', 'content': prompt}
                ],
                'max_tokens': self.max_tokens,
                'temperature': 0.7
            }
            
            response = requests.post(
                self.api_url,
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return result['choices'][0]['message']['content']
            else:
                logger.error(f"AI API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error calling AI API: {str(e)}")
            return None
    
    def _format_context(self, analysis_data: Dict[str, Any]) -> Dict[str, str]:
        """Format analysis data for prompt context"""
        # Format tables info
        tables_info = ""
        if analysis_data.get('tables'):
            for table in analysis_data['tables']:
                tables_info += f"Table: {table.get('name', 'Unknown')}\n"
                tables_info += f"  Rows: {table.get('rows', 'Unknown')}\n"
                tables_info += f"  DDL: {table.get('ddl', 'N/A')}\n\n"
        
        # Format indexes info
        indexes_info = ""
        if analysis_data.get('indexes'):
            for index in analysis_data['indexes']:
                indexes_info += f"Index: {index.get('name', 'Unknown')}\n"
                indexes_info += f"  Table: {index.get('table', 'Unknown')}\n"
                indexes_info += f"  Definition: {index.get('definition', 'N/A')}\n\n"
        
        # Format current analysis
        current_analysis = ""
        if analysis_data.get('report'):
            report = analysis_data['report']
            if report.get('summary'):
                current_analysis += f"Summary: {report['summary']}\n"
            if report.get('recommendations'):
                current_analysis += f"Recommendations: {report['recommendations']}\n"
            if report.get('warnings'):
                current_analysis += f"Warnings: {report['warnings']}\n"
        
        return {
            'sql_query': analysis_data.get('sql_query', ''),
            'db_engine': analysis_data.get('db_engine', ''),
            'explain_plan': analysis_data.get('explain_plan', ''),
            'tables_info': tables_info or 'No table information provided',
            'indexes_info': indexes_info or 'No index information provided',
            'current_analysis': current_analysis or 'No current analysis available'
        }
    
    def get_ai_insight(self, prompt_type: str, analysis_data: Dict[str, Any]) -> Dict[str, Any]:
        """Get AI insight for a specific prompt type"""
        if prompt_type not in self.prompts:
            return {
                'error': f'Unknown prompt type: {prompt_type}',
                'available_prompts': list(self.prompts.keys())
            }
        
        try:
            # Format the context
            context = self._format_context(analysis_data)
            
            # Get the prompt template
            prompt_template = self.prompts[prompt_type]['prompt']
            
            # Format the prompt with context
            formatted_prompt = prompt_template.format(**context)
            
            # Call AI API
            ai_response = self._call_ai_api(formatted_prompt)
            
            if ai_response:
                return {
                    'success': True,
                    'title': self.prompts[prompt_type]['title'],
                    'response': ai_response,
                    'prompt_type': prompt_type,
                    'timestamp': time.time()
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to get AI response',
                    'title': self.prompts[prompt_type]['title']
                }
                
        except Exception as e:
            logger.error(f"Error getting AI insight: {str(e)}")
            return {
                'success': False,
                'error': f'Error processing AI request: {str(e)}',
                'title': self.prompts[prompt_type]['title']
            }
    
    def get_available_prompts(self) -> List[Dict[str, str]]:
        """Get list of available prompt types"""
        return [
            {
                'type': prompt_type,
                'title': prompt_info['title'],
                'description': self._get_prompt_description(prompt_type)
            }
            for prompt_type, prompt_info in self.prompts.items()
        ]
    
    def _get_prompt_description(self, prompt_type: str) -> str:
        """Get description for each prompt type"""
        descriptions = {
            'why_slow': 'Identify performance bottlenecks and explain why the query might be slow',
            'optimize_query': 'Get specific, actionable optimization recommendations',
            'explain_simple': 'Understand the query and execution plan in simple terms',
            'index_recommendations': 'Get specific index suggestions to improve performance',
            'performance_breakdown': 'Detailed analysis of performance issues and root causes'
        }
        return descriptions.get(prompt_type, 'AI-powered analysis')

# Global AI service instance
ai_service = AIService() 