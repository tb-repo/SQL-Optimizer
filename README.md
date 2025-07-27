# SQL Performance Assistant - Advanced Execution Plan Visualizer

A comprehensive SQL performance optimization tool with advanced execution plan visualization and analysis capabilities.

## 🚀 Features

### **Multi-Database Support**
- **PostgreSQL**: Full support for JSON, TEXT, and XML EXPLAIN formats
- **Oracle**: Support for pipe-delimited and tree format execution plans
- **SQL Server**: Support for tree format and XML execution plans
- **Format-Agnostic**: Auto-detects and parses any explain plan format

### **Advanced Visualization**
- **Interactive D3.js Flowcharts**: Top-to-bottom execution flow visualization
- **Performance Hotspot Detection**: Automatically identifies costly operations
- **Multi-Factor Color Coding**: Based on cost, time, and I/O metrics
- **Rich Metrics Display**: Shows cost, rows, time, buffer usage per operation
- **Export Capabilities**: PNG and SVG export options
- **Zoom & Pan**: Interactive navigation with fit-to-screen functionality

### **Comprehensive Analysis**
- **Execution Plan Metrics**: Detailed analysis of cost, time, and I/O patterns
- **Performance Recommendations**: Actionable optimization suggestions
- **Hotspot Identification**: Highlights the most expensive operations
- **Buffer Analysis**: I/O performance insights and recommendations
- **Operation-Specific Advice**: Tailored recommendations for different operation types

## 🛠️ Installation

   ```bash
# Clone the repository
   git clone <repository-url>
cd SQL-Performance-Assistant

# Install dependencies
pip install -r requirements.txt

# Run the application
python app.py
```

## 📊 Usage

### **1. Basic SQL Analysis**
1. Enter your SQL query
2. Select your database engine (PostgreSQL, Oracle, SQL Server)
3. Optionally provide table DDL and index information
4. Click "Analyze" for comprehensive performance insights

### **2. Execution Plan Visualization**
1. Paste your EXPLAIN plan output (any format)
2. Click "Generate Visualization"
3. View the interactive flowchart with performance metrics
4. Use controls to zoom, toggle metrics, and export

### **3. Supported EXPLAIN Formats**

#### **PostgreSQL**
```sql
-- JSON Format (Recommended)
EXPLAIN (FORMAT JSON, ANALYZE, BUFFERS) SELECT * FROM users WHERE status = 'active';

-- TEXT Format
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM users WHERE status = 'active';

-- XML Format
EXPLAIN (FORMAT XML, ANALYZE, BUFFERS) SELECT * FROM users WHERE status = 'active';
```

#### **Oracle**
```sql
-- Standard Format
EXPLAIN PLAN FOR SELECT * FROM users WHERE status = 'active';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- Tree Format
EXPLAIN PLAN SET STATEMENT_ID = 'test' FOR SELECT * FROM users WHERE status = 'active';
```

#### **SQL Server**
```sql
-- Text Format
SET STATISTICS PROFILE ON;
SELECT * FROM users WHERE status = 'active';
SET STATISTICS PROFILE OFF;

-- XML Format
SET SHOWPLAN XML ON;
SELECT * FROM users WHERE status = 'active';
SET SHOWPLAN XML OFF;
```

## 🎯 Key Features Explained

### **Format Detection System**
The application automatically detects explain plan formats:
- **JSON**: Detects JSON structure with validation
- **XML**: Identifies XML tags and structure
- **PostgreSQL Text**: Recognizes indentation and `->` markers
- **Oracle**: Detects pipe-delimited tables and operation patterns
- **SQL Server**: Identifies `|--` tree structure

### **Enhanced Visualization**
- **True Execution Flow**: Shows actual parent-child relationships
- **Performance Indicators**: Visual cues for hotspots, I/O operations, and slow queries
- **Rich Tooltips**: Detailed metrics on hover
- **Interactive Controls**: Toggle visibility, zoom, and export options

### **Optimization Recommendations**
- **Operation-Specific**: Tailored advice for different operation types
- **Cost-Based**: Prioritizes recommendations by performance impact
- **Actionable**: Provides specific, implementable suggestions
- **Multi-Factor**: Considers cost, time, and I/O patterns

## 🔧 Technical Architecture

### **Backend (Flask/Python)**
- **Format Detection**: `detect_explain_format()` - Auto-detects explain plan formats
- **Parsing Engine**: `parse_explain_to_json()` - Converts any format to structured JSON
- **Analysis Engine**: `analyze_execution_plan_metrics()` - Generates optimization recommendations
- **Visualization API**: `/generate_explain_visualization` - Provides visualization data

### **Frontend (JavaScript/D3.js)**
- **D3.js Visualization**: `renderD3Tree()` - Interactive flowchart rendering
- **Dynamic Loading**: `ensureD3Loaded()` - Handles D3.js dependency loading
- **Interactive Features**: Zoom, pan, toggle, and export functionality
- **Performance Metrics**: Real-time calculation and display of metrics

### **Database Support Matrix**

| Feature | PostgreSQL | Oracle | SQL Server |
|---------|------------|--------|------------|
| JSON Format | ✅ | ❌ | ❌ |
| TEXT Format | ✅ | ✅ | ✅ |
| XML Format | ✅ | ❌ | ✅ |
| Buffer Analysis | ✅ | ❌ | ❌ |
| Cost Metrics | ✅ | ✅ | ✅ |
| Time Metrics | ✅ | ❌ | ❌ |

## 📈 Performance Analysis Features

### **Metrics Extracted**
- **Cost Analysis**: Startup and total cost for each operation
- **Row Counts**: Estimated vs actual row counts
- **Execution Time**: Actual execution time per operation
- **Buffer Usage**: Shared hits, reads, and writes
- **I/O Patterns**: Disk vs memory access patterns

### **Optimization Recommendations**
- **Index Recommendations**: Based on full table scans and join operations
- **Query Rewrites**: Suggestions for better query structure
- **Join Optimization**: Advice on join strategies and conditions
- **I/O Optimization**: Recommendations for reducing disk access

## 🎨 Visualization Features

### **Color Coding**
- **Green to Red**: Performance impact (low to high)
- **Multi-Factor**: Considers cost, time, and I/O together
- **Hotspot Highlighting**: Special styling for performance bottlenecks

### **Interactive Elements**
- **Zoom Controls**: Scale from 50% to 300%
- **Fit to Screen**: Automatic layout adjustment
- **Toggle Metrics**: Show/hide detailed metrics
- **Export Options**: PNG and SVG formats

### **Performance Indicators**
- **🔥 Hotspot**: High-cost operations
- **💾 I/O Heavy**: Operations with significant disk access
- **⏱️ Slow**: Operations with high execution time

## 🚀 Getting Started

### **Quick Start**
1. **Start the Application**:
   ```bash
   python app.py
   ```

2. **Access the Web Interface**:
   ```
   http://localhost:5000
   ```

3. **Test with Sample Data**:
   - Use the provided sample queries
   - Try different explain plan formats
   - Explore the visualization features

### **Sample Queries**
```sql
-- PostgreSQL Sample
SELECT u.name, o.order_date 
FROM users u 
JOIN orders o ON u.id = o.user_id 
WHERE u.status = 'active' 
ORDER BY o.order_date DESC;

-- Oracle Sample
SELECT u.name, o.order_date 
FROM users u, orders o 
WHERE u.id = o.user_id 
AND u.status = 'active' 
ORDER BY o.order_date DESC;

-- SQL Server Sample
SELECT u.name, o.order_date 
FROM users u 
INNER JOIN orders o ON u.id = o.user_id 
WHERE u.status = 'active' 
ORDER BY o.order_date DESC;
```

## 🔍 Advanced Usage

### **Custom Analysis**
- **Multiple Formats**: Mix and match different explain plan formats
- **Batch Processing**: Analyze multiple queries at once
- **Historical Analysis**: Track performance improvements over time
- **Comparative Analysis**: Compare different query execution plans

### **Integration**
- **API Endpoints**: RESTful API for programmatic access
- **Export Options**: JSON, CSV, and visualization exports
- **Custom Metrics**: Extensible metric calculation system

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests for new functionality
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Review existing issues
3. Create a new issue with detailed information
4. Include sample queries and explain plans when possible

---

**Built with ❤️ for SQL Performance Optimization** 