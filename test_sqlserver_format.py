#!/usr/bin/env python3
"""
Test script to verify SQL Server explain plan format detection and parsing
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the functions we want to test
from app import detect_explain_format, parse_explain_to_json

def test_sqlserver_text_format():
    """Test SQL Server text format detection and parsing"""
    
    # SQL Server text format example
    sqlserver_text = """| StmtText                              | PhysicalOp     | LogicalOp     | EstimateRows | EstimateIO | EstimateCPU | TotalSubtreeCost |
|--------------------------------------|----------------|---------------|--------------|------------|-------------|------------------|
| SELECT ...                           | SELECT          | SELECT         | 1.0          | 0.0032     | 0.0001581   | 0.0033581         |
|   ... FROM Orders                    | Nested Loops    | Inner Join     | 123.0        | 0.0025     | 0.0001      | 0.0026            |
|   ... JOIN Customers                 | Index Seek      | Seek           | 10.0         | 0.0002     | 0.00001     | 0.00021           |
|   ... JOIN OrderDetails              | Hash Match      | Inner Join     | 456.0        | 0.0041     | 0.0003      | 0.0044            |"""
    
    print("Testing SQL Server Text Format:")
    print("=" * 50)
    
    # Test format detection
    detected_format = detect_explain_format(sqlserver_text)
    print(f"Detected format: {detected_format}")
    
    # Test parsing
    result = parse_explain_to_json(sqlserver_text, 'sqlserver')
    if result:
        print("✅ Parsing successful!")
        print(f"Root operation: {result.get('operation', 'N/A')}")
        print(f"Number of children: {len(result.get('children', []))}")
        
        # Print children details
        for i, child in enumerate(result.get('children', [])):
            print(f"  Child {i+1}: {child.get('operation', 'N/A')} (Cost: {child.get('cost', 0)}, Rows: {child.get('rows', 0)})")
    else:
        print("❌ Parsing failed!")
    
    print()

def test_sqlserver_xml_format():
    """Test SQL Server XML format detection and parsing"""
    
    # SQL Server XML format example (simplified)
    sqlserver_xml = """<ShowPlanXML xmlns="http://schemas.microsoft.com/sqlserver/2004/07/showplan">
  <BatchSequence>
    <Batch>
      <Statements>
        <StmtSimple StatementSubTreeCost="3.56" StatementText="...">
          <QueryPlan DegreeOfParallelism="2">
            <RelOp NodeId="0" PhysicalOp="Top" LogicalOp="Top">
              <OutputList />
              <Top RowCount="1" />
              <RelOp NodeId="1" PhysicalOp="Sort" LogicalOp="Sort">
                <OutputList />
                <Sort OrderBy="TotalAmount DESC" />
                <RelOp NodeId="2" PhysicalOp="HashAggregate" LogicalOp="Hash"
                       EstimateRows="1500" EstimatedTotalSubtreeCost="2.34">
                  <GroupBy>
                    <DefinedValues>
                      <DefinedValue>
                        <ColumnReference Column="OrderID" />
                      </DefinedValue>
                      <DefinedValue>
                        <ColumnReference Column="CustomerName" />
                      </DefinedValue>
                    </DefinedValues>
                  </GroupBy>
                  <RelOp NodeId="3" PhysicalOp="HashMatch" LogicalOp="Inner Join">
                    <RelOp NodeId="4" PhysicalOp="Clustered Index Scan" LogicalOp="Clustered Index Scan"
                           EstimateRows="20000" EstimatedTotalSubtreeCost="1.00">
                      <Object Database="SalesDB" Schema="dbo" Table="Orders" Index="PK_Orders" />
                    </RelOp>
                    <RelOp NodeId="5" PhysicalOp="HashMatch" LogicalOp="Inner Join">
                      <RelOp NodeId="6" PhysicalOp="Clustered Index Scan" LogicalOp="Clustered Index Scan"
                             EstimateRows="30000" EstimatedTotalSubtreeCost="0.90">
                        <Object Table="OrderDetails" Index="PK_OrderDetails" />
                      </RelOp>
                      <RelOp NodeId="7" PhysicalOp="Clustered Index Scan" LogicalOp="Clustered Index Scan"
                             EstimateRows="5000" EstimatedTotalSubtreeCost="0.80">
                        <Object Table="Customers" Index="PK_Customers" />
                      </RelOp>
                    </RelOp>
                  </RelOp>
                </RelOp>
              </RelOp>
            </RelOp>
          </QueryPlan>
        </StmtSimple>
      </Statements>
    </Batch>
  </BatchSequence>
</ShowPlanXML>"""
    
    print("Testing SQL Server XML Format:")
    print("=" * 50)
    
    # Test format detection
    detected_format = detect_explain_format(sqlserver_xml)
    print(f"Detected format: {detected_format}")
    
    # Test parsing
    result = parse_explain_to_json(sqlserver_xml, 'sqlserver')
    if result:
        print("✅ Parsing successful!")
        print(f"Root operation: {result.get('operation', 'N/A')}")
        print(f"Number of children: {len(result.get('children', []))}")
        
        # Print children details
        for i, child in enumerate(result.get('children', [])):
            print(f"  Child {i+1}: {child.get('operation', 'N/A')} (Cost: {child.get('cost', 0)}, Rows: {child.get('rows', 0)})")
    else:
        print("❌ Parsing failed!")
    
    print()

def test_postgresql_misidentification():
    """Test that SQL Server plans are not misidentified as PostgreSQL"""
    
    # SQL Server text format that might be confused with PostgreSQL
    sqlserver_plan = """| StmtText                              | PhysicalOp     | LogicalOp     | EstimateRows | EstimateIO | EstimateCPU | TotalSubtreeCost |
|--------------------------------------|----------------|---------------|--------------|------------|-------------|------------------|
| SELECT ...                           | SELECT          | SELECT         | 1.0          | 0.0032     | 0.0001581   | 0.0033581         |
|   ... FROM Orders                    | Nested Loops    | Inner Join     | 123.0        | 0.0025     | 0.0001      | 0.0026            |"""
    
    print("Testing SQL Server vs PostgreSQL Misidentification:")
    print("=" * 60)
    
    # Test format detection
    detected_format = detect_explain_format(sqlserver_plan)
    print(f"Detected format: {detected_format}")
    
    # Test that it's not detected as PostgreSQL
    if detected_format == 'sqlserver':
        print("✅ Correctly identified as SQL Server")
    elif detected_format == 'postgresql_text':
        print("❌ Incorrectly identified as PostgreSQL")
    else:
        print(f"⚠️  Detected as: {detected_format}")
    
    print()

if __name__ == "__main__":
    print("SQL Server Format Detection and Parsing Tests")
    print("=" * 60)
    print()
    
    test_sqlserver_text_format()
    test_sqlserver_xml_format()
    test_postgresql_misidentification()
    
    print("Tests completed!") 