#!/usr/bin/env python3
"""
Test script for format detection and parsing of different explain plan formats
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import detect_explain_format, parse_explain_to_json

def test_postgresql_json():
    """Test PostgreSQL JSON format"""
    print("Testing PostgreSQL JSON format...")
    
    json_explain = '''[
  {
    "Plan": {
      "Node Type": "Hash Join",
      "Strategy": "Inner",
      "Total Cost": 1234.56,
      "Startup Cost": 0.00,
      "Plan Rows": 1000,
      "Actual Rows": 950,
      "Actual Total Time": 45.67,
      "Buffers": {
        "Shared Hit": 100,
        "Shared Read": 50,
        "Shared Written": 0
      },
      "Plans": [
        {
          "Node Type": "Seq Scan",
          "Relation Name": "users",
          "Total Cost": 500.00,
          "Plan Rows": 5000,
          "Actual Rows": 4800,
          "Actual Total Time": 20.00,
          "Buffers": {
            "Shared Hit": 50,
            "Shared Read": 25
          }
        },
        {
          "Node Type": "Index Scan",
          "Index Name": "idx_orders_user_id",
          "Relation Name": "orders",
          "Total Cost": 734.56,
          "Plan Rows": 1000,
          "Actual Rows": 950,
          "Actual Total Time": 25.67,
          "Buffers": {
            "Shared Hit": 50,
            "Shared Read": 25
          }
        }
      ]
    }
  }
]'''
    
    detected = detect_explain_format(json_explain)
    print(f"  Detected format: {detected}")
    
    parsed = parse_explain_to_json(json_explain, 'postgresql')
    if parsed:
        print(f"  Successfully parsed JSON format")
        print(f"  Root operation: {parsed.get('operation')}")
        print(f"  Total cost: {parsed.get('cost')}")
        print(f"  Children count: {len(parsed.get('children', []))}")
    else:
        print("  Failed to parse JSON format")
    
    print()

def test_postgresql_text():
    """Test PostgreSQL TEXT format"""
    print("Testing PostgreSQL TEXT format...")
    
    text_explain = '''Hash Join  (cost=1234.56..1234.56 rows=1000 width=8) (actual time=45.67..45.67 rows=950 loops=1)
  Hash Cond: (users.id = orders.user_id)
  Buffers: shared hit=100 read=50
  ->  Seq Scan on users  (cost=0.00..500.00 rows=5000 width=4) (actual time=20.00..20.00 rows=4800 loops=1)
        Filter: (status = 'active')
        Buffers: shared hit=50 read=25
  ->  Hash  (cost=734.56..734.56 rows=1000 width=4) (actual time=25.67..25.67 rows=950 loops=1)
        Buckets: 1024  Batches: 1  Memory Usage: 48kB
        Buffers: shared hit=50 read=25
        ->  Index Scan using idx_orders_user_id on orders  (cost=0.29..734.56 rows=1000 width=4) (actual time=0.05..15.00 rows=950 loops=1)
              Index Cond: (user_id IS NOT NULL)
              Buffers: shared hit=50 read=25
Planning Time: 1.23 ms
Execution Time: 46.90 ms'''
    
    detected = detect_explain_format(text_explain)
    print(f"  Detected format: {detected}")
    
    parsed = parse_explain_to_json(text_explain, 'postgresql')
    if parsed:
        print(f"  Successfully parsed TEXT format")
        print(f"  Root operation: {parsed.get('operation')}")
        print(f"  Total cost: {parsed.get('cost')}")
        print(f"  Children count: {len(parsed.get('children', []))}")
    else:
        print("  Failed to parse TEXT format")
    
    print()

def test_oracle_format():
    """Test Oracle format"""
    print("Testing Oracle format...")
    
    oracle_explain = '''| Id  | Operation                    | Name           | Rows  | Bytes | Cost (%CPU)| Time     |
|-----|----------------------------|----------------|-------|-------|------------|----------|
|   0 | SELECT STATEMENT           |                |   100 |  5200 |    1234 (1)| 00:00:01 |
|   1 |  HASH JOIN                 |                |   100 |  5200 |    1234 (1)| 00:00:01 |
|   2 |   TABLE ACCESS FULL        | USERS          |  5000 | 50000 |     500 (1)| 00:00:01 |
|   3 |   TABLE ACCESS BY INDEX    | ORDERS         |  1000 |  2000 |     734 (1)| 00:00:01 |
|   4 |    INDEX RANGE SCAN        | IDX_ORDERS_UID |  1000 |       |       5 (0)| 00:00:01 |'''
    
    detected = detect_explain_format(oracle_explain)
    print(f"  Detected format: {detected}")
    
    parsed = parse_explain_to_json(oracle_explain, 'oracle')
    if parsed:
        print(f"  Successfully parsed Oracle format")
        print(f"  Root operation: {parsed.get('operation')}")
        print(f"  Children count: {len(parsed.get('children', []))}")
    else:
        print("  Failed to parse Oracle format")
    
    print()

def test_sqlserver_format():
    """Test SQL Server format"""
    print("Testing SQL Server format...")
    
    sqlserver_explain = '''|--Hash Match(Inner Join, HASH:([users].[id])=([orders].[user_id]), RESIDUAL:([users].[id]=[orders].[user_id]))
   |--Table Scan(OBJECT:([testdb].[dbo].[users]))
   |--Hash Match(Aggregate, HASH:([orders].[user_id]), RESIDUAL:([orders].[user_id] IS NOT NULL))
        |--Index Scan(OBJECT:([testdb].[dbo].[orders].[idx_orders_user_id]))'''
    
    detected = detect_explain_format(sqlserver_explain)
    print(f"  Detected format: {detected}")
    
    parsed = parse_explain_to_json(sqlserver_explain, 'sqlserver')
    if parsed:
        print(f"  Successfully parsed SQL Server format")
        print(f"  Root operation: {parsed.get('operation')}")
        print(f"  Children count: {len(parsed.get('children', []))}")
    else:
        print("  Failed to parse SQL Server format")
    
    print()

def test_unknown_format():
    """Test unknown format"""
    print("Testing unknown format...")
    
    unknown_explain = '''This is some random text that doesn't match any known format'''
    
    detected = detect_explain_format(unknown_explain)
    print(f"  Detected format: {detected}")
    
    parsed = parse_explain_to_json(unknown_explain, 'postgresql')
    if parsed:
        print(f"  Successfully parsed unknown format")
    else:
        print("  Failed to parse unknown format (expected)")
    
    print()

def main():
    """Run all tests"""
    print("=" * 60)
    print("EXPLAIN PLAN FORMAT DETECTION AND PARSING TESTS")
    print("=" * 60)
    print()
    
    test_postgresql_json()
    test_postgresql_text()
    test_oracle_format()
    test_sqlserver_format()
    test_unknown_format()
    
    print("=" * 60)
    print("TESTS COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    main() 