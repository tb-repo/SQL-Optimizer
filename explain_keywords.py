EXPLAIN_KEYWORDS = {
    'postgresql': {
        'index': [
            'Index Scan', 'Index Only Scan', 'Index Scan Backward', 'Bitmap Index Scan', 'Bitmap Heap Scan',
            'BitmapAnd', 'BitmapOr', 'TID Scan', 'Parallel Index Scan', 'Parallel Index Only Scan',
            'Foreign Scan', 'Custom Scan'
        ],
        'sequential': ['Seq Scan', 'Sequential Scan'],
        'bitmap': ['Bitmap Index Scan', 'Bitmap Heap Scan', 'BitmapAnd', 'BitmapOr'],
        'parallel': ['Parallel Index Scan', 'Parallel Index Only Scan'],
        'table': ['Table Scan', 'CTE Scan', 'Subquery Scan'],
        'join': ['Nested Loop', 'Hash Join', 'Merge Join', 'Merge Append', 'Hash', 'Nested Loop Join'],
        'loop': ['Nested Loop', 'Nested Loop Join'],
        'sort': ['Sort', 'External Sort', 'Top-N Sort'],
        'aggregate': ['Aggregate', 'GroupAggregate', 'HashAggregate'],
        'filter': ['Filter', 'Index Cond', 'Recheck Cond', 'Table Filter'],
        'other': ['Materialize', 'Unique', 'SetOp', 'Append', 'Result', 'Limit', 'LockRows', 'Subquery Scan', 'Function Scan', 'Values Scan', 'Recursive Union', 'WorkTable Scan', 'Memoize'],
    },
    'oracle': {
        'index': [
            'INDEX UNIQUE SCAN', 'INDEX RANGE SCAN', 'INDEX FULL SCAN', 'INDEX FAST FULL SCAN', 'INDEX SKIP SCAN',
            'BITMAP INDEX SCAN'
        ],
        'bitmap': [
            'BITMAP INDEX SCAN', 'BITMAP CONVERSION TO ROWIDS', 'BITMAP CONVERSION FROM ROWIDS', 'BITMAP AND', 'BITMAP OR'
        ],
        'table': ['TABLE ACCESS FULL', 'TABLE ACCESS BY INDEX ROWID', 'TABLE ACCESS CLUSTER'],
        'join': ['NESTED LOOPS', 'HASH JOIN', 'MERGE JOIN', 'CARTESIAN JOIN'],
        'loop': ['NESTED LOOPS'],
        'sort': ['SORT', 'SORT AGGREGATE', 'SORT GROUP BY', 'SORT ORDER BY', 'SORT UNIQUE'],
        'aggregate': ['HASH GROUP BY', 'SORT GROUP BY', 'AGGREGATE'],
        'filter': ['FILTER', 'TABLE ACCESS FILTERED'],
        'other': ['VIEW', 'REMOTE', 'MERGE', 'UNION', 'UNION ALL', 'CONNECT BY', 'SEQUENCE', 'PARTITION RANGE', 'PARTITION LIST', 'PARTITION HASH', 'PARTITION'],
    },
    'mysql': {
        'index': ['index', 'range', 'ref', 'eq_ref', 'const', 'system', 'index_merge'],
        'table': ['ALL'],
        'join': ['ALL', 'index', 'range', 'ref', 'eq_ref', 'const', 'system', 'unique_subquery', 'index_subquery'],
        'loop': ['ALL'],
        'sort': ['filesort', 'Using filesort'],
        'aggregate': ['Using temporary', 'Using filesort'],
        'filter': ['Using where', 'Using index condition'],
        'other': ['Derived', 'Materialized', 'Subquery', 'Union', 'Dependent Union', 'Table function', 'Impossible WHERE', 'Impossible HAVING', 'Distinct'],
    },
    'sqlserver': {
        'index': [
            'Index Seek', 'Index Scan', 'Clustered Index Seek', 'Clustered Index Scan', 'Key Lookup', 'RID Lookup'
        ],
        'bitmap': ['Bitmap'],
        'table': ['Table Scan'],
        'join': ['Nested Loops', 'Hash Match', 'Merge Join', 'Loop Join'],
        'loop': ['Nested Loops', 'Loop Join'],
        'sort': ['Sort', 'Top N Sort'],
        'aggregate': ['Stream Aggregate', 'Hash Match (Aggregate)'],
        'filter': ['Filter', 'Predicate'],
        'other': ['Compute Scalar', 'Concatenation', 'Sequence Project', 'Segment', 'Table-valued function', 'Remote Query', 'Table Spool', 'Index Spool', 'Eager Spool', 'Lazy Spool', 'Assert', 'Distinct Sort', 'Parallelism', 'Bitmap', 'Window Aggregate'],
    },
    'sqlite': {
        'index': [
            'SEARCH TABLE', 'USING INDEX', 'USING COVERING INDEX', 'USING PRIMARY KEY',
            'USING AUTOMATIC INDEX', 'USING AUTOMATIC COVERING INDEX'
        ],
        'sequential': ['SCAN TABLE'],
        'table': ['SCAN TABLE', 'SCAN SUBQUERY'],
        'join': ['CROSS JOIN', 'INNER JOIN', 'LEFT JOIN', 'NATURAL JOIN'],
        'sort': ['USE TEMP B-TREE', 'USE TEMP B-TREE FOR ORDER BY'],
        'aggregate': ['USE TEMP B-TREE FOR GROUP BY'],
        'filter': ['SEARCH USING INDEX', 'SEARCH USING AUTOMATIC INDEX'],
        'other': ['EXECUTE SCALAR', 'EXECUTE CORRELATED', 'MATERIALIZE', 'CO-ROUTINE']
    }
} 