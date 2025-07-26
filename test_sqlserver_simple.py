#!/usr/bin/env python3
"""
Simple test script to verify SQL Server explain plan format detection
"""

import re
import json

def detect_explain_format(explain_plan):
    """Auto-detect explain plan format"""
    if not explain_plan:
        return 'unknown'
    
    plan_text = explain_plan.strip()
    
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
    
    # Check for SQL Server specific formats
    if any(keyword in plan_text for keyword in [
        'StmtText', 'PhysicalOp', 'LogicalOp', 'EstimateRows', 'EstimateIO', 'EstimateCPU', 'TotalSubtreeCost',
        '|--', 'Hash Match', 'Nested Loops', 'Index Seek', 'Clustered Index Scan', 'HashAggregate',
        'NodeId', 'PhysicalOp=', 'LogicalOp=', 'EstimateRows='
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

def test_sqlserver_text_format():
    """Test SQL Server text format detection"""
    
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
    
    if detected_format == 'sqlserver':
        print("✅ Correctly identified as SQL Server")
    else:
        print(f"❌ Incorrectly identified as: {detected_format}")
    
    print()

def test_sqlserver_xml_format():
    """Test SQL Server XML format detection"""
    
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
    
    if detected_format == 'xml':
        print("✅ Correctly identified as XML")
    else:
        print(f"❌ Incorrectly identified as: {detected_format}")
    
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

def test_postgresql_format():
    """Test PostgreSQL format to ensure it's not misidentified"""
    
    # PostgreSQL format example
    postgresql_plan = """QUERY PLAN
Hash Join  (cost=431.00..431.00 rows=1 width=4)
  Hash Cond: (users.id = orders.user_id)
  ->  Seq Scan on users  (cost=0.00..431.00 rows=21000 width=4)
        Filter: (status = 'active')
  ->  Hash  (cost=431.00..431.00 rows=1 width=4)
        ->  Seq Scan on orders  (cost=0.00..431.00 rows=1 width=4)
              Filter: (amount > 1000)
Planning Time: 0.123 ms
Execution Time: 0.456 ms"""
    
    print("Testing PostgreSQL Format:")
    print("=" * 50)
    
    # Test format detection
    detected_format = detect_explain_format(postgresql_plan)
    print(f"Detected format: {detected_format}")
    
    if detected_format == 'postgresql_text':
        print("✅ Correctly identified as PostgreSQL")
    else:
        print(f"❌ Incorrectly identified as: {detected_format}")
    
    print()

if __name__ == "__main__":
    print("SQL Server Format Detection Tests")
    print("=" * 60)
    print()
    
    test_sqlserver_text_format()
    test_sqlserver_xml_format()
    test_postgresql_misidentification()
    test_postgresql_format()
    
    print("Tests completed!") 