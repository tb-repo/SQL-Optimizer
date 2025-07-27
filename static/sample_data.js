// SQL Performance Assistant - Sample Data for SQL Server
// This file contains comprehensive sample data for the "Load Sample" feature

const SQL_SERVER_SAMPLE_DATA = {
    engine: 'sqlserver',
    name: 'SQL Server - Complex Order Analysis Query',
    description: 'A complex query demonstrating joins, aggregation, filtering, and sorting with multiple performance considerations.',
    
    // Table DDL
    table_ddl: `-- Customers table
CREATE TABLE Customers (
    CustomerID INT PRIMARY KEY,
    CustomerName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(255),
    Phone NVARCHAR(20),
    Address NVARCHAR(500),
    City NVARCHAR(100),
    Country NVARCHAR(100),
    CreatedDate DATETIME DEFAULT GETDATE()
);

-- Orders table
CREATE TABLE Orders (
    OrderID INT PRIMARY KEY,
    CustomerID INT NOT NULL,
    OrderDate DATE NOT NULL,
    RequiredDate DATE,
    ShippedDate DATE,
    ShipVia INT,
    Freight DECIMAL(10,2),
    ShipName NVARCHAR(100),
    ShipAddress NVARCHAR(500),
    ShipCity NVARCHAR(100),
    ShipCountry NVARCHAR(100),
    Status NVARCHAR(20) DEFAULT 'Pending',
    FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID)
);

-- OrderDetails table
CREATE TABLE OrderDetails (
    OrderDetailID INT PRIMARY KEY,
    OrderID INT NOT NULL,
    ProductID INT,
    UnitPrice DECIMAL(10,2) NOT NULL,
    Quantity INT NOT NULL,
    Discount DECIMAL(3,2) DEFAULT 0.00,
    FOREIGN KEY (OrderID) REFERENCES Orders(OrderID)
);`,

    // Index DDL
    index_ddl: `-- Primary indexes (already created with PRIMARY KEY constraints)
-- Customers: CustomerID (clustered)
-- Orders: OrderID (clustered) 
-- OrderDetails: OrderDetailID (clustered)

-- Performance indexes for the query
CREATE INDEX IX_Orders_CustomerID ON Orders(CustomerID);
CREATE INDEX IX_Orders_OrderDate ON Orders(OrderDate);
CREATE INDEX IX_Orders_CustomerID_OrderDate ON Orders(CustomerID, OrderDate);

CREATE INDEX IX_OrderDetails_OrderID ON OrderDetails(OrderID);
CREATE INDEX IX_OrderDetails_ProductID ON OrderDetails(ProductID);
CREATE INDEX IX_OrderDetails_OrderID_ProductID ON OrderDetails(OrderID, ProductID);

-- Additional indexes for other common queries
CREATE INDEX IX_Customers_City ON Customers(City);
CREATE INDEX IX_Customers_Country ON Customers(Country);
CREATE INDEX IX_Orders_Status ON Orders(Status);
CREATE INDEX IX_Orders_ShippedDate ON Orders(ShippedDate);`,

    // SQL Query
    sql_query: `SELECT
    o.OrderID,
    c.CustomerName,
    SUM(od.Quantity * od.UnitPrice) AS TotalAmount,
    COUNT(od.OrderDetailID) AS ItemCount,
    o.OrderDate,
    o.Status
FROM
    Orders o
JOIN
    Customers c ON o.CustomerID = c.CustomerID
JOIN
    OrderDetails od ON o.OrderID = od.OrderID
WHERE
    o.OrderDate >= '2022-01-01'
    AND o.OrderDate < '2023-01-01'
    AND o.Status IN ('Shipped', 'Delivered')
GROUP BY
    o.OrderID, c.CustomerName, o.OrderDate, o.Status
HAVING
    SUM(od.Quantity * od.UnitPrice) > 1000
ORDER BY
    TotalAmount DESC;`,

    // Explain Plan - SHOWPLAN_XML (Estimated Plan)
    explain_plan_xml: `<ShowPlanXML xmlns="http://schemas.microsoft.com/sqlserver/2004/07/showplan">
  <BatchSequence>
    <Batch>
      <Statements>
        <StmtSimple StatementSubTreeCost="3.56" StatementText="SELECT o.OrderID, c.CustomerName, SUM(od.Quantity * od.UnitPrice) AS TotalAmount, COUNT(od.OrderDetailID) AS ItemCount, o.OrderDate, o.Status FROM Orders o JOIN Customers c ON o.CustomerID = c.CustomerID JOIN OrderDetails od ON o.OrderID = od.OrderID WHERE o.OrderDate >= '2022-01-01' AND o.OrderDate < '2023-01-01' AND o.Status IN ('Shipped', 'Delivered') GROUP BY o.OrderID, c.CustomerName, o.OrderDate, o.Status HAVING SUM(od.Quantity * od.UnitPrice) > 1000 ORDER BY TotalAmount DESC;">
          <QueryPlan DegreeOfParallelism="2" CachedPlanSize="32" CompileTime="5" CompileCPU="4" CompileMemory="456">
            <MissingIndexes>
              <MissingIndexGroup Impact="95.5">
                <MissingIndex Database="SalesDB" Schema="dbo" Table="Orders">
                  <ColumnGroup Usage="EQUALITY">
                    <Column Name="Status" ColumnId="6" />
                  </ColumnGroup>
                  <ColumnGroup Usage="INEQUALITY">
                    <Column Name="OrderDate" ColumnId="3" />
                  </ColumnGroup>
                  <ColumnGroup Usage="INCLUDE">
                    <Column Name="CustomerID" ColumnId="2" />
                    <Column Name="OrderID" ColumnId="1" />
                  </ColumnGroup>
                </MissingIndex>
              </MissingIndexGroup>
            </MissingIndexes>
            <RelOp NodeId="0" PhysicalOp="Top" LogicalOp="Top" EstimateRows="1" EstimateIO="0" EstimateCPU="0.0001581" AvgRowSize="87" EstimatedTotalSubtreeCost="3.56" Parallel="0" EstimateRebinds="0" EstimateRewinds="0">
              <OutputList>
                <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderID" />
                <ColumnReference Database="SalesDB" Schema="dbo" Table="Customers" Column="CustomerName" />
                <ColumnReference Column="Expr1003" />
                <ColumnReference Column="Expr1004" />
                <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderDate" />
                <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="Status" />
              </OutputList>
              <Top RowCount="1" IsPercent="0" WithTies="0">
                <TopExpression>
                  <ScalarOperator ScalarString="[Expr1003]">
                    <Identifier>
                      <ColumnReference Column="Expr1003" />
                    </Identifier>
                  </ScalarOperator>
                </TopExpression>
              </Top>
              <RelOp NodeId="1" PhysicalOp="Sort" LogicalOp="Sort" EstimateRows="1500" EstimateIO="0.0112613" EstimateCPU="0.0045004" AvgRowSize="87" EstimatedTotalSubtreeCost="3.56" Parallel="0" EstimateRebinds="0" EstimateRewinds="0">
                <OutputList>
                  <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderID" />
                  <ColumnReference Database="SalesDB" Schema="dbo" Table="Customers" Column="CustomerName" />
                  <ColumnReference Column="Expr1003" />
                  <ColumnReference Column="Expr1004" />
                  <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderDate" />
                  <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="Status" />
                </OutputList>
                <MemoryFractions Input="1" Output="1" />
                <Sort Distinct="0">
                  <OrderBy>
                    <OrderByColumn Ascending="0">
                      <ColumnReference Column="Expr1003" />
                    </OrderByColumn>
                  </OrderBy>
                </Sort>
                <RelOp NodeId="2" PhysicalOp="HashAggregate" LogicalOp="Hash" EstimateRows="1500" EstimateIO="0" EstimateCPU="0.0045004" AvgRowSize="87" EstimatedTotalSubtreeCost="3.54" Parallel="0" EstimateRebinds="0" EstimateRewinds="0">
                  <OutputList>
                    <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderID" />
                    <ColumnReference Database="SalesDB" Schema="dbo" Table="Customers" Column="CustomerName" />
                    <ColumnReference Column="Expr1003" />
                    <ColumnReference Column="Expr1004" />
                    <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderDate" />
                    <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="Status" />
                  </OutputList>
                  <MemoryFractions Input="1" Output="1" />
                  <HashKeysBuild>
                    <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderID" />
                    <ColumnReference Database="SalesDB" Schema="dbo" Table="Customers" Column="CustomerName" />
                    <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderDate" />
                    <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="Status" />
                  </HashKeysBuild>
                  <HashKeysProbe />
                  <DefinedValues>
                    <DefinedValue>
                      <ColumnReference Column="Expr1003" />
                      <ScalarOperator ScalarString="SUM([SalesDB].[dbo].[OrderDetails].[Quantity]*[SalesDB].[dbo].[OrderDetails].[UnitPrice])">
                        <Aggregate AggType="SUM" Distinct="0">
                          <ScalarOperator>
                            <Arithmetic Operation="MULT">
                              <ScalarOperator>
                                <Identifier>
                                  <ColumnReference Database="SalesDB" Schema="dbo" Table="OrderDetails" Column="Quantity" />
                                </Identifier>
                              </ScalarOperator>
                              <ScalarOperator>
                                <Identifier>
                                  <ColumnReference Database="SalesDB" Schema="dbo" Table="OrderDetails" Column="UnitPrice" />
                                </Identifier>
                              </ScalarOperator>
                            </Arithmetic>
                          </ScalarOperator>
                        </Aggregate>
                      </ScalarOperator>
                    </DefinedValue>
                    <DefinedValue>
                      <ColumnReference Column="Expr1004" />
                      <ScalarOperator ScalarString="COUNT([SalesDB].[dbo].[OrderDetails].[OrderDetailID])">
                        <Aggregate AggType="COUNT" Distinct="0">
                          <ScalarOperator>
                            <Identifier>
                              <ColumnReference Database="SalesDB" Schema="dbo" Table="OrderDetails" Column="OrderDetailID" />
                            </Identifier>
                          </ScalarOperator>
                        </Aggregate>
                      </ScalarOperator>
                    </DefinedValue>
                  </DefinedValues>
                  <Filter>
                    <ScalarOperator ScalarString="SUM([SalesDB].[dbo].[OrderDetails].[Quantity]*[SalesDB].[dbo].[OrderDetails].[UnitPrice])>(1000.)">
                      <Compare CompareOp="GT">
                        <ScalarOperator>
                          <Aggregate AggType="SUM" Distinct="0">
                            <ScalarOperator>
                              <Arithmetic Operation="MULT">
                                <ScalarOperator>
                                  <Identifier>
                                    <ColumnReference Database="SalesDB" Schema="dbo" Table="OrderDetails" Column="Quantity" />
                                  </Identifier>
                                </ScalarOperator>
                                <ScalarOperator>
                                  <Identifier>
                                    <ColumnReference Database="SalesDB" Schema="dbo" Table="OrderDetails" Column="UnitPrice" />
                                  </Identifier>
                                </ScalarOperator>
                              </Arithmetic>
                            </ScalarOperator>
                          </Aggregate>
                        </ScalarOperator>
                        <ScalarOperator>
                          <Const ConstValue="(1000.)" />
                        </ScalarOperator>
                      </Compare>
                    </ScalarOperator>
                  </Filter>
                  <RelOp NodeId="3" PhysicalOp="HashMatch" LogicalOp="Inner Join" EstimateRows="25000" EstimateIO="0" EstimateCPU="0.0001581" AvgRowSize="47" EstimatedTotalSubtreeCost="2.34" Parallel="0" EstimateRebinds="0" EstimateRewinds="0">
                    <OutputList>
                      <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderID" />
                      <ColumnReference Database="SalesDB" Schema="dbo" Table="Customers" Column="CustomerName" />
                      <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderDate" />
                      <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="Status" />
                      <ColumnReference Database="SalesDB" Schema="dbo" Table="OrderDetails" Column="Quantity" />
                      <ColumnReference Database="SalesDB" Schema="dbo" Table="OrderDetails" Column="UnitPrice" />
                      <ColumnReference Database="SalesDB" Schema="dbo" Table="OrderDetails" Column="OrderDetailID" />
                    </OutputList>
                    <MemoryFractions Input="0.5" Output="0.5" />
                    <HashKeysBuild>
                      <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderID" />
                    </HashKeysBuild>
                    <HashKeysProbe>
                      <ColumnReference Database="SalesDB" Schema="dbo" Table="OrderDetails" Column="OrderID" />
                    </HashKeysProbe>
                    <RelOp NodeId="4" PhysicalOp="HashMatch" LogicalOp="Inner Join" EstimateRows="20000" EstimateIO="0" EstimateCPU="0.0001581" AvgRowSize="35" EstimatedTotalSubtreeCost="1.00" Parallel="0" EstimateRebinds="0" EstimateRewinds="0">
                      <OutputList>
                        <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderID" />
                        <ColumnReference Database="SalesDB" Schema="dbo" Table="Customers" Column="CustomerName" />
                        <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderDate" />
                        <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="Status" />
                      </OutputList>
                      <MemoryFractions Input="0.5" Output="0.5" />
                      <HashKeysBuild>
                        <ColumnReference Database="SalesDB" Schema="dbo" Table="Customers" Column="CustomerID" />
                      </HashKeysBuild>
                      <HashKeysProbe>
                        <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="CustomerID" />
                      </HashKeysProbe>
                      <RelOp NodeId="5" PhysicalOp="Clustered Index Scan" LogicalOp="Clustered Index Scan" EstimateRows="5000" EstimateIO="0.25" EstimateCPU="0.0001581" AvgRowSize="27" EstimatedTotalSubtreeCost="0.25" TableCardinality="5000" Parallel="0" EstimateRebinds="0" EstimateRewinds="0">
                        <OutputList>
                          <ColumnReference Database="SalesDB" Schema="dbo" Table="Customers" Column="CustomerID" />
                          <ColumnReference Database="SalesDB" Schema="dbo" Table="Customers" Column="CustomerName" />
                        </OutputList>
                        <Object Database="SalesDB" Schema="dbo" Table="Customers" Index="PK_Customers" />
                      </RelOp>
                      <RelOp NodeId="6" PhysicalOp="Clustered Index Scan" LogicalOp="Clustered Index Scan" EstimateRows="20000" EstimateIO="0.75" EstimateCPU="0.0001581" AvgRowSize="15" EstimatedTotalSubtreeCost="0.75" TableCardinality="50000" Parallel="0" EstimateRebinds="0" EstimateRewinds="0">
                        <OutputList>
                          <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderID" />
                          <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="CustomerID" />
                          <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderDate" />
                          <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="Status" />
                        </OutputList>
                        <Object Database="SalesDB" Schema="dbo" Table="Orders" Index="PK_Orders" />
                        <Predicate>
                          <ScalarOperator ScalarString="[SalesDB].[dbo].[Orders].[OrderDate]>='2022-01-01' AND [SalesDB].[dbo].[Orders].[OrderDate]<'2023-01-01' AND [SalesDB].[dbo].[Orders].[Status]='Shipped' OR [SalesDB].[dbo].[Orders].[Status]='Delivered'">
                            <Logical Operation="AND">
                              <ScalarOperator>
                                <Logical Operation="AND">
                                  <ScalarOperator>
                                    <Compare CompareOp="GE">
                                      <ScalarOperator>
                                        <Identifier>
                                          <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderDate" />
                                        </Identifier>
                                      </ScalarOperator>
                                      <ScalarOperator>
                                        <Const ConstValue="'2022-01-01'" />
                                      </ScalarOperator>
                                    </Compare>
                                  </ScalarOperator>
                                  <ScalarOperator>
                                    <Compare CompareOp="LT">
                                      <ScalarOperator>
                                        <Identifier>
                                          <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="OrderDate" />
                                        </Identifier>
                                      </ScalarOperator>
                                      <ScalarOperator>
                                        <Const ConstValue="'2023-01-01'" />
                                      </ScalarOperator>
                                    </Compare>
                                  </ScalarOperator>
                                </Logical>
                              </ScalarOperator>
                              <ScalarOperator>
                                <Logical Operation="OR">
                                  <ScalarOperator>
                                    <Compare CompareOp="EQ">
                                      <ScalarOperator>
                                        <Identifier>
                                          <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="Status" />
                                        </Identifier>
                                      </ScalarOperator>
                                      <ScalarOperator>
                                        <Const ConstValue="'Shipped'" />
                                      </ScalarOperator>
                                    </Compare>
                                  </ScalarOperator>
                                  <ScalarOperator>
                                    <Compare CompareOp="EQ">
                                      <ScalarOperator>
                                        <Identifier>
                                          <ColumnReference Database="SalesDB" Schema="dbo" Table="Orders" Column="Status" />
                                        </Identifier>
                                      </ScalarOperator>
                                      <ScalarOperator>
                                        <Const ConstValue="'Delivered'" />
                                      </ScalarOperator>
                                    </Compare>
                                  </ScalarOperator>
                                </Logical>
                              </ScalarOperator>
                            </Logical>
                          </ScalarOperator>
                        </Predicate>
                      </RelOp>
                    </RelOp>
                    <RelOp NodeId="7" PhysicalOp="Clustered Index Scan" LogicalOp="Clustered Index Scan" EstimateRows="30000" EstimateIO="0.90" EstimateCPU="0.0001581" AvgRowSize="20" EstimatedTotalSubtreeCost="0.90" TableCardinality="100000" Parallel="0" EstimateRebinds="0" EstimateRewinds="0">
                      <OutputList>
                        <ColumnReference Database="SalesDB" Schema="dbo" Table="OrderDetails" Column="OrderID" />
                        <ColumnReference Database="SalesDB" Schema="dbo" Table="OrderDetails" Column="Quantity" />
                        <ColumnReference Database="SalesDB" Schema="dbo" Table="OrderDetails" Column="UnitPrice" />
                        <ColumnReference Database="SalesDB" Schema="dbo" Table="OrderDetails" Column="OrderDetailID" />
                      </OutputList>
                      <Object Database="SalesDB" Schema="dbo" Table="OrderDetails" Index="PK_OrderDetails" />
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
</ShowPlanXML>`,

    // Explain Plan - STATISTICS PROFILE (Tabular format)
    explain_plan_text: `| StmtText                              | PhysicalOp     | LogicalOp     | EstimateRows | ActualRows | TotalSubtreeCost |
|--------------------------------------|----------------|---------------|--------------|------------|------------------|
| SELECT o.OrderID, c.CustomerName... | Top           | Top          | 1.0          | 1          | 3.56             |
|   ... FROM Orders o                 | Sort          | Sort         | 1500.0       | 1500       | 3.54             |
|   ... JOIN Customers c              | HashAggregate | Hash         | 1500.0       | 1500       | 3.54             |
|   ... JOIN OrderDetails od          | HashMatch     | Inner Join   | 25000.0      | 25000      | 2.34             |
|   ... JOIN Customers c              | HashMatch     | Inner Join   | 20000.0      | 20000      | 1.00             |
|   ... Clustered Index Scan          | Clustered Index Scan | Clustered Index Scan | 5000.0 | 5000 | 0.25 |
|   ... Clustered Index Scan          | Clustered Index Scan | Clustered Index Scan | 20000.0 | 20000 | 0.75 |
|   ... Clustered Index Scan          | Clustered Index Scan | Clustered Index Scan | 30000.0 | 30000 | 0.90 |`,

    // Performance Analysis Notes
    analysis_notes: `🔍 **Performance Analysis Highlights:**

**Costliest Operations:**
- HashAggregate (Node 2): 3.54 cost - Most expensive due to grouping and aggregation
- HashMatch joins (Nodes 3, 4): 2.34 and 1.00 cost - Hash joins for large datasets
- Clustered Index Scans: Multiple full table scans indicate missing indexes

**Key Issues Identified:**
1. **Missing Index Warning**: SQL Server suggests creating a composite index on Orders(Status, OrderDate) INCLUDE (CustomerID, OrderID)
2. **Full Table Scans**: All three tables use clustered index scans instead of seeks
3. **Hash Joins**: Used for large datasets, but could be optimized with better indexes

**Optimization Recommendations:**
1. Create the suggested missing index: CREATE INDEX IX_Orders_Status_OrderDate ON Orders(Status, OrderDate) INCLUDE (CustomerID, OrderID)
2. Consider covering indexes for the join conditions
3. Review statistics on OrderDate and Status columns
4. Consider partitioning large tables by OrderDate

**Expected Improvements:**
- Index seek instead of scan on Orders table
- Reduced I/O cost from ~2.34 to ~0.5
- Better join performance with indexed lookups`,

    // Sample data for testing (optional)
    sample_data: `-- Sample data for testing (optional)
INSERT INTO Customers (CustomerID, CustomerName, Email, City, Country) VALUES
(1, 'Acme Corp', 'contact@acme.com', 'New York', 'USA'),
(2, 'TechStart Inc', 'info@techstart.com', 'San Francisco', 'USA'),
(3, 'Global Solutions', 'sales@globalsolutions.com', 'London', 'UK'),
(4, 'Innovation Labs', 'hello@innovationlabs.com', 'Toronto', 'Canada'),
(5, 'Future Systems', 'support@futuresystems.com', 'Sydney', 'Australia');

INSERT INTO Orders (OrderID, CustomerID, OrderDate, Status) VALUES
(1001, 1, '2022-03-15', 'Shipped'),
(1002, 2, '2022-06-20', 'Delivered'),
(1003, 1, '2022-08-10', 'Shipped'),
(1004, 3, '2022-11-05', 'Delivered'),
(1005, 2, '2022-12-18', 'Shipped');

INSERT INTO OrderDetails (OrderDetailID, OrderID, ProductID, UnitPrice, Quantity) VALUES
(2001, 1001, 101, 29.99, 5),
(2002, 1001, 102, 49.99, 2),
(2003, 1002, 103, 199.99, 1),
(2004, 1003, 101, 29.99, 10),
(2005, 1004, 104, 399.99, 1),
(2006, 1005, 102, 49.99, 8);`
};

// PostgreSQL Sample Data
const POSTGRESQL_SAMPLE_DATA = {
    engine: 'postgresql',
    name: 'PostgreSQL - Complex Analytics Query',
    description: 'A complex query demonstrating window functions, CTEs, and advanced PostgreSQL features.',
    
    // Table DDL
    table_ddl: `-- Customers table
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    order_date DATE NOT NULL,
    required_date DATE,
    shipped_date DATE,
    ship_via INTEGER,
    freight DECIMAL(10,2),
    ship_name VARCHAR(100),
    ship_address TEXT,
    ship_city VARCHAR(100),
    ship_country VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Pending',
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- OrderDetails table
CREATE TABLE order_details (
    order_detail_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL,
    discount DECIMAL(3,2) DEFAULT 0.00,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);`,

    // Index DDL
    index_ddl: `-- Performance indexes for the query
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_customer_id_order_date ON orders(customer_id, order_date);
CREATE INDEX idx_orders_status ON orders(status);

CREATE INDEX idx_order_details_order_id ON order_details(order_id);
CREATE INDEX idx_order_details_product_id ON order_details(product_id);
CREATE INDEX idx_order_details_order_id_product_id ON order_details(order_id, product_id);

-- Additional indexes for other common queries
CREATE INDEX idx_customers_city ON customers(city);
CREATE INDEX idx_customers_country ON customers(country);
CREATE INDEX idx_orders_shipped_date ON orders(shipped_date);`,

    // SQL Query
    sql_query: `WITH order_summary AS (
    SELECT
        o.order_id,
        c.customer_name,
        o.order_date,
        o.status,
        SUM(od.quantity * od.unit_price) AS total_amount,
        COUNT(od.order_detail_id) AS item_count,
        ROW_NUMBER() OVER (PARTITION BY c.customer_id ORDER BY o.order_date DESC) as rn
    FROM
        orders o
    JOIN
        customers c ON o.customer_id = c.customer_id
    JOIN
        order_details od ON o.order_id = od.order_id
    WHERE
        o.order_date >= '2022-01-01'
        AND o.order_date < '2023-01-01'
        AND o.status IN ('Shipped', 'Delivered')
    GROUP BY
        o.order_id, c.customer_name, o.order_date, o.status, c.customer_id
    HAVING
        SUM(od.quantity * od.unit_price) > 1000
)
SELECT
    order_id,
    customer_name,
    total_amount,
    item_count,
    order_date,
    status,
    RANK() OVER (ORDER BY total_amount DESC) as amount_rank
FROM order_summary
WHERE rn = 1
ORDER BY total_amount DESC;`,

    // Explain Plan - JSON format
    explain_plan_json: `[
  {
    "Node Type": "Sort",
    "Startup Cost": 0.0,
    "Total Cost": 3.56,
    "Plan Rows": 1500,
    "Plan Width": 87,
    "Sort Key": ["total_amount DESC"],
    "Sort Method": "quicksort",
    "Sort Space Used": 256,
    "Sort Space Type": "Memory",
    "Plans": [
      {
        "Node Type": "WindowAgg",
        "Startup Cost": 0.0,
        "Total Cost": 3.54,
        "Plan Rows": 1500,
        "Plan Width": 87,
        "Window Functions": ["rank"],
        "Plans": [
          {
            "Node Type": "WindowAgg",
            "Startup Cost": 0.0,
            "Total Cost": 3.52,
            "Plan Rows": 1500,
            "Plan Width": 87,
            "Window Functions": ["row_number"],
            "Plans": [
              {
                "Node Type": "HashAggregate",
                "Startup Cost": 0.0,
                "Total Cost": 3.50,
                "Plan Rows": 1500,
                "Plan Width": 87,
                "Group Key": ["o.order_id", "c.customer_name", "o.order_date", "o.status", "c.customer_id"],
                "Filter": "(sum((od.quantity * od.unit_price)) > 1000.00)",
                "HashAggregate": {
                  "Hash Buckets": 1024,
                  "Hash Batches": 1,
                  "Peak Memory Usage": 8192
                },
                "Plans": [
                  {
                    "Node Type": "Hash Join",
                    "Startup Cost": 0.0,
                    "Total Cost": 2.34,
                    "Plan Rows": 25000,
                    "Plan Width": 47,
                    "Hash Cond": "(o.order_id = od.order_id)",
                    "Hash Join": {
                      "Hash Buckets": 1024,
                      "Hash Batches": 1,
                      "Peak Memory Usage": 8192
                    },
                    "Plans": [
                      {
                        "Node Type": "Hash Join",
                        "Startup Cost": 0.0,
                        "Total Cost": 1.00,
                        "Plan Rows": 20000,
                        "Plan Width": 35,
                        "Hash Cond": "(o.customer_id = c.customer_id)",
                        "Hash Join": {
                          "Hash Buckets": 1024,
                          "Hash Batches": 1,
                          "Peak Memory Usage": 8192
                        },
                        "Plans": [
                          {
                            "Node Type": "Seq Scan",
                            "Startup Cost": 0.0,
                            "Total Cost": 0.25,
                            "Plan Rows": 5000,
                            "Plan Width": 27,
                            "Filter": "((c.customer_name IS NOT NULL) AND (c.email IS NOT NULL))",
                            "Relation Name": "customers",
                            "Alias": "c"
                          },
                          {
                            "Node Type": "Seq Scan",
                            "Startup Cost": 0.0,
                            "Total Cost": 0.75,
                            "Plan Rows": 20000,
                            "Plan Width": 15,
                            "Filter": "((o.order_date >= '2022-01-01'::date) AND (o.order_date < '2023-01-01'::date) AND ((o.status)::text = ANY ('{Shipped,Delivered}'::text[])))",
                            "Relation Name": "orders",
                            "Alias": "o"
                          }
                        ]
                      },
                      {
                        "Node Type": "Seq Scan",
                        "Startup Cost": 0.0,
                        "Total Cost": 0.90,
                        "Plan Rows": 30000,
                        "Plan Width": 20,
                        "Relation Name": "order_details",
                        "Alias": "od"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
]`,

    // Explain Plan - TEXT format
    explain_plan_text: `Sort  (cost=3.56..3.56 rows=1500 width=87) (actual time=45.123..45.234 rows=1500 loops=1)
  Sort Key: total_amount DESC
  Sort Method: quicksort  Memory: 256kB
  ->  WindowAgg  (cost=0.00..3.54 rows=1500 width=87) (actual time=12.345..44.567 rows=1500 loops=1)
        ->  WindowAgg  (cost=0.00..3.52 rows=1500 width=87) (actual time=12.234..43.456 rows=1500 loops=1)
              ->  HashAggregate  (cost=0.00..3.50 rows=1500 width=87) (actual time=12.123..42.345 rows=1500 loops=1)
                    Group Key: o.order_id, c.customer_name, o.order_date, o.status, c.customer_id
                    Filter: (sum((od.quantity * od.unit_price)) > 1000.00)
                    HashAggregate: Hash Buckets: 1024, Hash Batches: 1, Peak Memory Usage: 8192 kB
                    ->  Hash Join  (cost=0.00..2.34 rows=25000 width=47) (actual time=8.901..40.123 rows=25000 loops=1)
                          Hash Cond: (o.order_id = od.order_id)
                          HashAggregate: Hash Buckets: 1024, Hash Batches: 1, Peak Memory Usage: 8192 kB
                          ->  Hash Join  (cost=0.00..1.00 rows=20000 width=35) (actual time=5.678..35.456 rows=20000 loops=1)
                                Hash Cond: (o.customer_id = c.customer_id)
                                HashAggregate: Hash Buckets: 1024, Hash Batches: 1, Peak Memory Usage: 8192 kB
                                ->  Seq Scan on customers c  (cost=0.00..0.25 rows=5000 width=27) (actual time=0.123..2.345 rows=5000 loops=1)
                                      Filter: ((c.customer_name IS NOT NULL) AND (c.email IS NOT NULL))
                                ->  Seq Scan on orders o  (cost=0.00..0.75 rows=20000 width=15) (actual time=0.234..3.456 rows=20000 loops=1)
                                      Filter: ((o.order_date >= '2022-01-01'::date) AND (o.order_date < '2023-01-01'::date) AND ((o.status)::text = ANY ('{Shipped,Delivered}'::text[])))
                          ->  Seq Scan on order_details od  (cost=0.00..0.90 rows=30000 width=20) (actual time=0.345..4.567 rows=30000 loops=1)
Planning Time: 2.345 ms
Execution Time: 45.678 ms`,

    // Performance Analysis Notes
    analysis_notes: `🔍 **PostgreSQL Performance Analysis Highlights:**

**Costliest Operations:**
- Sort (Node 1): 3.56 cost - Most expensive due to sorting large result set
- HashAggregate (Node 3): 3.50 cost - Grouping and aggregation operations
- Hash Join operations: Multiple hash joins for large datasets

**Key Issues Identified:**
1. **Sequential Scans**: All three tables use seq scans instead of index scans
2. **Hash Joins**: Used for large datasets, indicating missing or suboptimal indexes
3. **Memory Usage**: HashAggregate uses 8192 kB memory, could be optimized
4. **Sort Operation**: Quicksort in memory (256kB) for final result ordering

**Optimization Recommendations:**
1. Create composite indexes for join conditions and WHERE clauses
2. Consider covering indexes to avoid table lookups
3. Review table statistics and vacuum/analyze tables
4. Consider partitioning large tables by order_date

**Expected Improvements:**
- Index scans instead of sequential scans
- Reduced hash join costs with better indexes
- Better memory utilization with optimized indexes`,

    // Sample data for testing
    sample_data: `-- Sample data for testing
INSERT INTO customers (customer_id, customer_name, email, city, country) VALUES
(1, 'Acme Corp', 'contact@acme.com', 'New York', 'USA'),
(2, 'TechStart Inc', 'info@techstart.com', 'San Francisco', 'USA'),
(3, 'Global Solutions', 'sales@globalsolutions.com', 'London', 'UK'),
(4, 'Innovation Labs', 'hello@innovationlabs.com', 'Toronto', 'Canada'),
(5, 'Future Systems', 'support@futuresystems.com', 'Sydney', 'Australia');

INSERT INTO orders (order_id, customer_id, order_date, status) VALUES
(1001, 1, '2022-03-15', 'Shipped'),
(1002, 2, '2022-06-20', 'Delivered'),
(1003, 1, '2022-08-10', 'Shipped'),
(1004, 3, '2022-11-05', 'Delivered'),
(1005, 2, '2022-12-18', 'Shipped');

INSERT INTO order_details (order_detail_id, order_id, product_id, unit_price, quantity) VALUES
(2001, 1001, 101, 29.99, 5),
(2002, 1001, 102, 49.99, 2),
(2003, 1002, 103, 199.99, 1),
(2004, 1003, 101, 29.99, 10),
(2005, 1004, 104, 399.99, 1),
(2006, 1005, 102, 49.99, 8);`
};

// Oracle Sample Data
const ORACLE_SAMPLE_DATA = {
    engine: 'oracle',
    name: 'Oracle - Advanced Analytics Query',
    description: 'A complex query demonstrating Oracle-specific features like hierarchical queries and advanced analytics.',
    
    // Table DDL
    table_ddl: `-- Customers table
CREATE TABLE customers (
    customer_id NUMBER PRIMARY KEY,
    customer_name VARCHAR2(100) NOT NULL,
    email VARCHAR2(255),
    phone VARCHAR2(20),
    address CLOB,
    city VARCHAR2(100),
    country VARCHAR2(100),
    created_date DATE DEFAULT SYSDATE
);

-- Orders table
CREATE TABLE orders (
    order_id NUMBER PRIMARY KEY,
    customer_id NUMBER NOT NULL,
    order_date DATE NOT NULL,
    required_date DATE,
    shipped_date DATE,
    ship_via NUMBER,
    freight NUMBER(10,2),
    ship_name VARCHAR2(100),
    ship_address CLOB,
    ship_city VARCHAR2(100),
    ship_country VARCHAR2(100),
    status VARCHAR2(20) DEFAULT 'Pending',
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- OrderDetails table
CREATE TABLE order_details (
    order_detail_id NUMBER PRIMARY KEY,
    order_id NUMBER NOT NULL,
    product_id NUMBER,
    unit_price NUMBER(10,2) NOT NULL,
    quantity NUMBER NOT NULL,
    discount NUMBER(3,2) DEFAULT 0.00,
    CONSTRAINT fk_orderdetails_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
);`,

    // Index DDL
    index_ddl: `-- Performance indexes for the query
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_customer_id_order_date ON orders(customer_id, order_date);
CREATE INDEX idx_orders_status ON orders(status);

CREATE INDEX idx_order_details_order_id ON order_details(order_id);
CREATE INDEX idx_order_details_product_id ON order_details(product_id);
CREATE INDEX idx_order_details_order_id_product_id ON order_details(order_id, product_id);

-- Additional indexes for other common queries
CREATE INDEX idx_customers_city ON customers(city);
CREATE INDEX idx_customers_country ON customers(country);
CREATE INDEX idx_orders_shipped_date ON orders(shipped_date);`,

    // SQL Query
    sql_query: `SELECT
    o.order_id,
    c.customer_name,
    o.order_date,
    o.status,
    SUM(od.quantity * od.unit_price) AS total_amount,
    COUNT(od.order_detail_id) AS item_count,
    RANK() OVER (ORDER BY SUM(od.quantity * od.unit_price) DESC) as amount_rank,
    LAG(SUM(od.quantity * od.unit_price)) OVER (ORDER BY o.order_date) as prev_amount
FROM
    orders o
JOIN
    customers c ON o.customer_id = c.customer_id
JOIN
    order_details od ON o.order_id = od.order_id
WHERE
    o.order_date >= DATE '2022-01-01'
    AND o.order_date < DATE '2023-01-01'
    AND o.status IN ('Shipped', 'Delivered')
GROUP BY
    o.order_id, c.customer_name, o.order_date, o.status
HAVING
    SUM(od.quantity * od.unit_price) > 1000
ORDER BY
    total_amount DESC;`,

    // Explain Plan - Tree format
    explain_plan_text: `--------------------------------------------------------------------------------
| Id  | Operation                    | Name              | Rows  | Bytes | Cost (%CPU)| Time     |
--------------------------------------------------------------------------------
|   0 | SELECT STATEMENT            |                   |  1500 |   130K|     356   (1)| 00:00:05 |
|   1 |  SORT ORDER BY              |                   |  1500 |   130K|     356   (1)| 00:00:05 |
|   2 |   WINDOW SORT PUSHED RANK   |                   |  1500 |   130K|     354   (1)| 00:00:05 |
|   3 |    WINDOW BUFFER            |                   |  1500 |   130K|     352   (1)| 00:00:05 |
|   4 |     HASH GROUP BY           |                   |  1500 |   130K|     350   (1)| 00:00:05 |
|   5 |      HASH JOIN              |                   | 25000 |  2156K|     234   (1)| 00:00:03 |
|   6 |       HASH JOIN             |                   | 20000 |  1400K|     100   (1)| 00:00:02 |
|   7 |        TABLE ACCESS FULL    | CUSTOMERS         |  5000 |   135K|      25   (0)| 00:00:01 |
|   8 |        TABLE ACCESS FULL    | ORDERS            | 20000 |   300K|      75   (0)| 00:00:01 |
|   9 |       TABLE ACCESS FULL     | ORDER_DETAILS     | 30000 |   600K|      90   (0)| 00:00:01 |
--------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------
   8 - filter("O"."ORDER_DATE">=TO_DATE(' 2022-01-01 00:00:00', 'syyyy-mm-dd hh24:mi:ss') AND "O"."ORDER_DATE"<TO_DATE(' 2023-01-01 00:00:00', 'syyyy-mm-dd hh24:mi:ss') AND ("O"."STATUS"='Shipped' OR "O"."STATUS"='Delivered'))
   9 - filter("OD"."ORDER_ID" IS NOT NULL)

Column Projection Information (identified by operation id):
----------------------------------------------------------
   1 - (#keys=1) "O"."ORDER_ID"[NUMBER,22], "C"."CUSTOMER_NAME"[VARCHAR2,100], "O"."ORDER_DATE"[DATE,7], "O"."STATUS"[VARCHAR2,20], SUM("OD"."QUANTITY"*"OD"."UNIT_PRICE")[22], COUNT("OD"."ORDER_DETAIL_ID")[22], RANK() OVER ( ORDER BY SUM("OD"."QUANTITY"*"OD"."UNIT_PRICE") DESC)[22], LAG(SUM("OD"."QUANTITY"*"OD"."UNIT_PRICE"),1) OVER ( ORDER BY "O"."ORDER_DATE")[22]
   2 - (#keys=1) "O"."ORDER_ID"[NUMBER,22], "C"."CUSTOMER_NAME"[VARCHAR2,100], "O"."ORDER_DATE"[DATE,7], "O"."STATUS"[VARCHAR2,20], SUM("OD"."QUANTITY"*"OD"."UNIT_PRICE")[22], COUNT("OD"."ORDER_DETAIL_ID")[22], RANK() OVER ( ORDER BY SUM("OD"."QUANTITY"*"OD"."UNIT_PRICE") DESC)[22], LAG(SUM("OD"."QUANTITY"*"OD"."UNIT_PRICE"),1) OVER ( ORDER BY "O"."ORDER_DATE")[22]
   3 - (#keys=1) "O"."ORDER_ID"[NUMBER,22], "C"."CUSTOMER_NAME"[VARCHAR2,100], "O"."ORDER_DATE"[DATE,7], "O"."STATUS"[VARCHAR2,20], SUM("OD"."QUANTITY"*"OD"."UNIT_PRICE")[22], COUNT("OD"."ORDER_DETAIL_ID")[22], RANK() OVER ( ORDER BY SUM("OD"."QUANTITY"*"OD"."UNIT_PRICE") DESC)[22], LAG(SUM("OD"."QUANTITY"*"OD"."UNIT_PRICE"),1) OVER ( ORDER BY "O"."ORDER_DATE")[22]
   4 - (#keys=4) "O"."ORDER_ID"[NUMBER,22], "C"."CUSTOMER_NAME"[VARCHAR2,100], "O"."ORDER_DATE"[DATE,7], "O"."STATUS"[VARCHAR2,20], SUM("OD"."QUANTITY"*"OD"."UNIT_PRICE")[22], COUNT("OD"."ORDER_DETAIL_ID")[22]
   5 - (#keys=1) "O"."ORDER_ID"[NUMBER,22], "C"."CUSTOMER_NAME"[VARCHAR2,100], "O"."ORDER_DATE"[DATE,7], "O"."STATUS"[VARCHAR2,20], "OD"."QUANTITY"[NUMBER,22], "OD"."UNIT_PRICE"[NUMBER,22], "OD"."ORDER_DETAIL_ID"[NUMBER,22]
   6 - (#keys=1) "O"."ORDER_ID"[NUMBER,22], "O"."CUSTOMER_ID"[NUMBER,22], "O"."ORDER_DATE"[DATE,7], "O"."STATUS"[VARCHAR2,20], "C"."CUSTOMER_NAME"[VARCHAR2,100]
   7 - "C"."CUSTOMER_ID"[NUMBER,22], "C"."CUSTOMER_NAME"[VARCHAR2,100]
   8 - "O"."ORDER_ID"[NUMBER,22], "O"."CUSTOMER_ID"[NUMBER,22], "O"."ORDER_DATE"[DATE,7], "O"."STATUS"[VARCHAR2,20]
   9 - "OD"."ORDER_ID"[NUMBER,22], "OD"."QUANTITY"[NUMBER,22], "OD"."UNIT_PRICE"[NUMBER,22], "OD"."ORDER_DETAIL_ID"[NUMBER,22]

Note
-----
   - dynamic sampling used for this statement (level=2)
   - this is an adaptive plan`,

    // Performance Analysis Notes
    analysis_notes: `🔍 **Oracle Performance Analysis Highlights:**

**Costliest Operations:**
- SORT ORDER BY (Id 1): 356 cost - Most expensive due to sorting large result set
- WINDOW SORT PUSHED RANK (Id 2): 354 cost - Window function processing
- HASH GROUP BY (Id 4): 350 cost - Grouping and aggregation operations

**Key Issues Identified:**
1. **Full Table Scans**: All three tables use TABLE ACCESS FULL instead of index scans
2. **Hash Joins**: Used for large datasets, indicating missing or suboptimal indexes
3. **Dynamic Sampling**: Oracle used dynamic sampling (level=2) for statistics
4. **Adaptive Plan**: Oracle chose an adaptive execution plan

**Optimization Recommendations:**
1. Create composite indexes for join conditions and WHERE clauses
2. Update table statistics to avoid dynamic sampling
3. Consider covering indexes to avoid table lookups
4. Review partition strategy for large tables

**Expected Improvements:**
- Index scans instead of full table scans
- Reduced hash join costs with better indexes
- More stable execution plans with updated statistics
- Better performance with proper indexing strategy`,

    // Sample data for testing
    sample_data: `-- Sample data for testing
INSERT INTO customers (customer_id, customer_name, email, city, country) VALUES
(1, 'Acme Corp', 'contact@acme.com', 'New York', 'USA');
INSERT INTO customers (customer_id, customer_name, email, city, country) VALUES
(2, 'TechStart Inc', 'info@techstart.com', 'San Francisco', 'USA');
INSERT INTO customers (customer_id, customer_name, email, city, country) VALUES
(3, 'Global Solutions', 'sales@globalsolutions.com', 'London', 'UK');
INSERT INTO customers (customer_id, customer_name, email, city, country) VALUES
(4, 'Innovation Labs', 'hello@innovationlabs.com', 'Toronto', 'Canada');
INSERT INTO customers (customer_id, customer_name, email, city, country) VALUES
(5, 'Future Systems', 'support@futuresystems.com', 'Sydney', 'Australia');

INSERT INTO orders (order_id, customer_id, order_date, status) VALUES
(1001, 1, DATE '2022-03-15', 'Shipped');
INSERT INTO orders (order_id, customer_id, order_date, status) VALUES
(1002, 2, DATE '2022-06-20', 'Delivered');
INSERT INTO orders (order_id, customer_id, order_date, status) VALUES
(1003, 1, DATE '2022-08-10', 'Shipped');
INSERT INTO orders (order_id, customer_id, order_date, status) VALUES
(1004, 3, DATE '2022-11-05', 'Delivered');
INSERT INTO orders (order_id, customer_id, order_date, status) VALUES
(1005, 2, DATE '2022-12-18', 'Shipped');

INSERT INTO order_details (order_detail_id, order_id, product_id, unit_price, quantity) VALUES
(2001, 1001, 101, 29.99, 5);
INSERT INTO order_details (order_detail_id, order_id, product_id, unit_price, quantity) VALUES
(2002, 1001, 102, 49.99, 2);
INSERT INTO order_details (order_detail_id, order_id, product_id, unit_price, quantity) VALUES
(2003, 1002, 103, 199.99, 1);
INSERT INTO order_details (order_detail_id, order_id, product_id, unit_price, quantity) VALUES
(2004, 1003, 101, 29.99, 10);
INSERT INTO order_details (order_detail_id, order_id, product_id, unit_price, quantity) VALUES
(2005, 1004, 104, 399.99, 1);
INSERT INTO order_details (order_detail_id, order_id, product_id, unit_price, quantity) VALUES
(2006, 1005, 102, 49.99, 8);`
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SQL_SERVER_SAMPLE_DATA, POSTGRESQL_SAMPLE_DATA, ORACLE_SAMPLE_DATA };
} 