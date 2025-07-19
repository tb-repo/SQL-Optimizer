# SQL Optimizer - Advanced Query Performance Analyzer

A comprehensive web-based SQL query performance analyzer that provides detailed insights, optimization recommendations, and advanced analytics for database queries across multiple engines.

## 🚀 Features

### Core Analysis
- **Multi-Engine Support**: MySQL, PostgreSQL, SQL Server, Oracle, SQLite
- **Real-time SQL Validation**: Instant syntax checking and feedback
- **Performance Scoring**: 1-100 performance score with detailed breakdown
- **Smart Recommendations**: Engine-specific optimization suggestions
- **Query Beautification**: Automatic SQL formatting and indentation

### Advanced Features
- **Query Comparison**: Compare up to 5 queries side-by-side
- **Analytics Dashboard**: Performance trends and insights over time
- **Share Links**: Generate shareable URLs for analysis results
- **Export Options**: JSON, CSV, and Markdown export formats
- **Dark Mode**: Modern UI with light/dark theme support

### Professional Tools
- **Table & Index Analysis**: Include DDL and index information for accurate analysis
- **EXPLAIN Plan Visualization**: Visual query execution plans
- **Sample Data Loader**: Pre-built examples for testing
- **Query Templates**: Library of common SQL patterns
- **Performance Metrics**: Complexity scores, optimization potential, resource usage

## 🛠️ Installation

### Prerequisites
- Python 3.8 or higher
- pip (Python package installer)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SQL-Optimizer
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**
   ```bash
   python app.py
   ```

4. **Access the application**
   Open your browser and navigate to `http://localhost:5000`

## 📋 Requirements

Create a `requirements.txt` file with the following dependencies:

```
Flask==2.3.3
Flask-WTF==1.1.1
WTForms==3.0.1
sqlparse==0.4.4
sql-formatter==12.2.3
```

## 🎯 Usage Guide

### Basic Analysis
1. **Enter SQL Query**: Paste your SQL query in the main text area
2. **Select Database Engine**: Choose your target database (PostgreSQL, MySQL, etc.)
3. **Add Table Information** (Optional): Include CREATE TABLE statements for better analysis
4. **Add Index Information** (Optional): Include existing indexes for accurate recommendations
5. **Add EXPLAIN Plan** (Optional): Paste EXPLAIN output for detailed execution analysis
6. **Click "Analyze SQL"**: Get comprehensive performance report

### Advanced Features

#### Query Comparison
- Navigate to the "Compare" page
- Enter 2-5 SQL queries to compare
- Select appropriate database engines
- View side-by-side performance analysis and rankings

#### Analytics Dashboard
- Access via "Analytics" button
- View performance trends over time
- Analyze query patterns and complexity distribution
- Get AI-generated insights and recommendations

#### Share Analysis
- Click "Share" button on any analysis result
- URL automatically copied to clipboard
- Share with team members (24-hour expiration)
- Recipients can view complete analysis and copy to their history

## 🏗️ Project Structure

```
SQL-Optimizer/
├── app.py                 # Main Flask application
├── templates/             # HTML templates
│   ├── index.html        # Main input page
│   ├── result.html       # Analysis results page
│   ├── shared_result.html # Shared analysis page
│   ├── compare.html      # Query comparison page
│   ├── analytics.html    # Analytics dashboard
│   └── help.html         # Help guide
├── static/               # Static assets
│   ├── scripts.js        # Main JavaScript functionality
│   ├── styles.css        # Custom CSS styles
│   ├── tips.js          # Engine-specific tips
│   └── templates.js     # Query templates library
├── requirements.txt      # Python dependencies
├── .gitignore           # Git ignore rules
└── README.md           # This file
```

## 🔧 Configuration

### Environment Variables
- `SECRET_KEY`: Flask secret key for session management
- `DEBUG`: Set to `True` for development mode

### Customization
- **Tips**: Modify `static/tips.js` to add custom database-specific tips
- **Templates**: Add query templates in `static/templates.js`
- **Styling**: Customize appearance in `static/styles.css`

## 🎨 Features in Detail

### Performance Analysis
- **Execution Time Estimation**: Relative performance metrics
- **Complexity Scoring**: Query complexity analysis (1-100)
- **Optimization Potential**: Percentage of improvement possible
- **Resource Usage**: Memory and CPU usage estimates
- **Performance Grades**: A-F grading system

### Smart Recommendations
- **Index Suggestions**: Missing index recommendations
- **Query Optimization**: Rewritten optimized queries
- **Best Practices**: Engine-specific optimization tips
- **Performance Warnings**: Potential issues and bottlenecks

### Export Capabilities
- **JSON Export**: Complete analysis data for programmatic use
- **CSV Export**: Tabular format for spreadsheet analysis
- **Markdown Export**: Formatted documentation
- **History Export**: All analysis history

## 🔒 Security Features

- **CSRF Protection**: All forms protected against CSRF attacks
- **Input Validation**: Comprehensive SQL and data validation
- **Session Management**: Secure session handling
- **Share Link Expiration**: 24-hour expiration for shared analyses
- **XSS Prevention**: Proper output escaping and sanitization

## 🚀 Performance Optimizations

- **Client-side Validation**: Real-time feedback without server requests
- **Efficient Data Structures**: Optimized for large query analysis
- **Caching**: Session-based caching for repeated analyses
- **Responsive Design**: Mobile-friendly interface
- **Progressive Enhancement**: Works without JavaScript

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check the built-in help guide at `/help`
- **Issues**: Report bugs and feature requests via GitHub issues
- **Questions**: Use GitHub discussions for general questions

## 🎉 Acknowledgments

- **Flask**: Web framework
- **Bootstrap**: UI components and styling
- **Chart.js**: Analytics visualizations
- **Font Awesome**: Icons
- **SQLParse**: SQL parsing and formatting

---

**Built with ❤️ for the database community** 