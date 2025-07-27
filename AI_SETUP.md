# AI Integration Setup Guide

This guide will help you set up AI-powered insights for your SQL Query Optimizer application.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure AI Provider

#### Option A: OpenAI (Recommended)
```bash
export AI_API_KEY="your-openai-api-key"
export AI_API_URL="https://api.openai.com/v1/chat/completions"
export AI_MODEL="gpt-3.5-turbo"
export AI_MAX_TOKENS="1000"
```

#### Option B: Azure OpenAI
```bash
export AI_API_KEY="your-azure-api-key"
export AI_API_URL="https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2023-05-15"
export AI_MODEL="gpt-35-turbo"
export AI_MAX_TOKENS="1000"
```

#### Option C: Anthropic Claude
```bash
export AI_API_KEY="your-anthropic-api-key"
export AI_API_URL="https://api.anthropic.com/v1/messages"
export AI_MODEL="claude-3-sonnet-20240229"
export AI_MAX_TOKENS="1000"
```

### 3. Run the Application
```bash
python app.py
```

## 🔧 Configuration Details

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AI_API_KEY` | Your AI provider API key | None | Yes |
| `AI_API_URL` | AI provider API endpoint | OpenAI | No |
| `AI_MODEL` | AI model to use | gpt-3.5-turbo | No |
| `AI_MAX_TOKENS` | Maximum tokens per response | 1000 | No |

### Supported AI Providers

#### OpenAI
- **API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Models**: gpt-3.5-turbo, gpt-4, gpt-4-turbo
- **Cost**: ~$0.002 per 1K tokens

#### Azure OpenAI
- **Setup**: Deploy model in Azure OpenAI Service
- **Models**: gpt-35-turbo, gpt-4, gpt-4-turbo
- **Cost**: Azure pricing

#### Anthropic Claude
- **API Key**: Get from [Anthropic Console](https://console.anthropic.com/)
- **Models**: claude-3-sonnet-20240229, claude-3-opus-20240229
- **Cost**: ~$0.003 per 1K tokens

## 🎯 Available AI Prompts

The application includes 5 pre-defined AI prompts:

### 1. "Why is this SQL slow?"
- **Purpose**: Identify performance bottlenecks
- **Best for**: Understanding query slowness
- **Output**: Conversational explanation of issues

### 2. "How can this query be optimized?"
- **Purpose**: Get actionable optimization recommendations
- **Best for**: Improving query performance
- **Output**: Specific, implementable suggestions

### 3. "Explain this plan like I'm 5"
- **Purpose**: Simple explanation of query execution
- **Best for**: Beginners and non-technical users
- **Output**: Easy-to-understand breakdown

### 4. "What indexes should I create?"
- **Purpose**: Index recommendations
- **Best for**: Database optimization
- **Output**: Specific CREATE INDEX statements

### 5. "Break down the performance issues"
- **Purpose**: Detailed performance analysis
- **Best for**: Advanced users and DBAs
- **Output**: Comprehensive technical analysis

## 🔒 Security Considerations

### API Key Security
- Never commit API keys to version control
- Use environment variables or secure key management
- Consider using a secrets manager for production

### Data Privacy
- AI responses are not permanently stored
- Query data is only sent to AI provider for analysis
- Consider data residency requirements

### Rate Limiting
- Implement rate limiting for AI requests
- Monitor API usage and costs
- Set appropriate timeouts

## 🛠️ Customization

### Adding New Prompts

1. Edit `ai_service.py`
2. Add new prompt to the `prompts` dictionary:

```python
'custom_prompt': {
    'title': 'Your Custom Title',
    'prompt': """Your custom prompt template with placeholders:
    {sql_query}
    {db_engine}
    {explain_plan}
    {tables_info}
    {indexes_info}
    {current_analysis}
    """
}
```

3. Add description in `_get_prompt_description()` method

### Modifying Existing Prompts

Edit the prompt templates in `ai_service.py` to:
- Change the tone or style
- Add specific instructions
- Include additional context
- Modify output format

### Custom AI Providers

To add support for other AI providers:

1. Create a new method in `AIService` class
2. Implement the provider's API format
3. Update the `_call_ai_api()` method
4. Add provider-specific configuration

## 📊 Monitoring and Analytics

### Logging
- AI requests are logged with timestamps
- Errors are captured for debugging
- Response times are tracked

### Usage Tracking
- Monitor API costs
- Track prompt popularity
- Analyze user engagement

### Error Handling
- Graceful fallback when AI is unavailable
- User-friendly error messages
- Retry mechanisms for transient failures

## 🚀 Production Deployment

### Environment Setup
```bash
# Production environment variables
export FLASK_ENV=production
export SECRET_KEY="your-secure-secret-key"
export AI_API_KEY="your-production-api-key"
```

### Performance Optimization
- Implement caching for AI responses
- Use connection pooling for API calls
- Consider async processing for long requests

### Scaling Considerations
- Load balancing for multiple instances
- Database session management
- API rate limiting and quotas

## 🐛 Troubleshooting

### Common Issues

#### "AI service not available"
- Check API key configuration
- Verify API endpoint URL
- Test API connectivity

#### "Failed to get AI response"
- Check API quota/limits
- Verify model availability
- Review error logs

#### "Timeout errors"
- Increase timeout settings
- Check network connectivity
- Consider using faster models

### Debug Mode
Enable debug logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 📚 Additional Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Azure OpenAI Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Anthropic API Documentation](https://docs.anthropic.com/)

## 🤝 Support

For issues with AI integration:
1. Check the troubleshooting section
2. Review application logs
3. Test API connectivity
4. Verify configuration settings 