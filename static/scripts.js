// Reserved words should be loaded prior from wordlist.js

// Initialize DOM elements when they're available
let cell_input, cell_output, textarea;

// Create a Resize function and add a Resize observer on the textbox //
// All text functions should go here 

const equalResize = () => {
    if (!textarea || !cell_input || !cell_output) return;
    
    try {
		let bounds = textarea.getBoundingClientRect()
		cell_input.style.minHeight = bounds.height + 'px' // Allows the Outer Div to collapse
		cell_output.style.minHeight = bounds.height + 'px'
		cell_output.style.minWidth = bounds.width + 'px'
    } catch (e) {
        console.log('equalResize error:', e);
    }
	return null
}

// Initialize elements when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    cell_input = document.getElementById('cell_input');
    cell_output = document.getElementById('cell_output');
    textarea = document.getElementById('textarea');
    
    if (textarea && cell_input && cell_output) {
        equalResize();
        new ResizeObserver(equalResize).observe(cell_input);
    }
});



// Need a function to evaluate the contents of the input textbox //


// I keep creating classed spans, so I might as well just make it a function
const spanClass = ( _class = '' , txt = '' ) => {
	return `<span class="${_class}">${txt}</span>`
}


// \t|\s|\(|\)|\[|\]

const wordChecker = (wordlist, text) => {
	let upper = text.toUpperCase()

	let match = wordlist.find( word => word === upper)?? null
	let isMatch = match? true: false 
	let out = isMatch? upper: text

	return {isMatch, out} 

}

const update = (wordlist = null) =>{
    if (!textarea || !cell_output) return;
    
    try {
	let dicedInput = textarea.value.split(/(?=[\t|\s|\(|\)|\[|\]])|(?<=[\t|\s|\(|\)|\[|\]])/g)
	// console.log(dicedInput)

	let outputHTML = dicedInput.map( el => {
		if(el == '\n' ){ return spanClass( 'linebreak' , '<br>') }
		if(el == '\t' ){ return spanClass('tabspace', '&nbsp;&nbsp;&nbsp;&nbsp;' ) }
		

			// quotes // 
		if( /'/.test(el) ){ return spanClass('singlequotes', el) }
		if( /"/.test(el) ){ return spanClass('danger', el) }

			// letters
		if( /[a-z]/i.test(el) ){ // we will be doing more with this later 
			if(wordlist){
				let {isMatch, out} = wordChecker(wordlist, el)
				let _cls = isMatch? 'matched' : 'letters'
				return spanClass( _cls, out)
			} else {
				return spanClass('letters', el)
			}
		} 

			// just numbers //
		if( /\d/.test(el) ){ // numbers only
			return spanClass('numbers', el)
		}

			// brackets //
		if( /[\(|\)|\[|\]]/.test(el)){ return spanClass('brackets', el) }
		if(!/[a-z\d]/i.test(el)){ return `<span class="whitespace">${el}</span>` }
		return el
	})
	.join('')

	//console.log(outputHTML)
	cell_output.innerHTML = outputHTML
    } catch (e) {
        console.log('update function error:', e);
    }
}


// Initialize update function when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (typeof update === 'function' && typeof reserved_words !== 'undefined') {
        update(reserved_words);
    }
});

// Add event listener when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (textarea) {
textarea.addEventListener('keydown', function(e) {
  if (e.key == 'Tab') {
    e.preventDefault();
    var start = this.selectionStart;
    var end = this.selectionEnd;

    // set textarea value to: text before caret + tab + text after caret
    this.value = this.value.substring(0, start) +
      "\t" + this.value.substring(end);

    // put caret at right position again
    this.selectionStart =
      this.selectionEnd = start + 1;
  }

            if (typeof update === 'function' && typeof reserved_words !== 'undefined') {
                update(reserved_words);
            }
        });
    }
});

// Load tips from external file
let currentTipIndex = 0;

// Initialize tips when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tips after a short delay to ensure tips.js is loaded
    setTimeout(() => {
        initializeTips();
    }, 100);
});

function initializeTips() {
    // Get tips from the global engineTips variable (loaded from tips.js)
    if (typeof window.engineTips !== 'undefined') {
        // Use the global engineTips directly
        updateEngineTips();
        
        // Start the rotation timer
        startTipsRotation();
        
        // Add event listener for engine changes
        const engineSelect = document.getElementById('db_engine_select');
        if (engineSelect) {
            engineSelect.addEventListener('change', updateEngineTips);
        }
    }
}

function updateEngineTips() {
    const engineSelect = document.getElementById('db_engine_select');
    const tipsContainer = document.getElementById('engine-tips-single');
    const engineNameSpan = document.getElementById('engine-tips-engine');
    
    if (!engineSelect || !tipsContainer || !engineNameSpan) return;
    
    const selectedEngine = engineSelect.value;
    const tips = window.engineTips[selectedEngine] || [];
    
    if (tips.length > 0) {
        // Update engine name
        engineNameSpan.textContent = selectedEngine;
        
        // Show first tip
        currentTipIndex = 0;
        showCurrentTip();
        
        // Reset progress bar
        resetProgressBar();
    }
}

function showCurrentTip() {
    const engineSelect = document.getElementById('db_engine_select');
    const tipsContainer = document.getElementById('engine-tips-single');
    
    if (!engineSelect || !tipsContainer) return;
    
    const selectedEngine = engineSelect.value;
    const tips = window.engineTips[selectedEngine] || [];
    
    if (tips.length > 0) {
        const tipText = tips[currentTipIndex];
        
        // Set the tip text directly
        tipsContainer.textContent = tipText;
        
        // Reset progress bar
        resetProgressBar();
    }
}

function resetProgressBar() {
    const progressBar = document.querySelector('.did-you-know-progress-bar');
    if (progressBar) {
        progressBar.style.animation = 'none';
        progressBar.offsetHeight; // Trigger reflow
        progressBar.style.animation = 'progress-fill 15s linear infinite';
    }
}

function startTipsRotation() {
    setInterval(() => {
        const engineSelect = document.getElementById('db_engine_select');
        if (!engineSelect) return;
        
        const selectedEngine = engineSelect.value;
        const tips = window.engineTips[selectedEngine] || [];
        
        if (tips.length > 1) {
            currentTipIndex = (currentTipIndex + 1) % tips.length;
            showCurrentTip();
        }
    }, 15000); // Rotate every 15 seconds
}

// --- CSV Upload and Modal Logic ---
document.addEventListener('DOMContentLoaded', function() {
    // CSV upload handlers
    document.getElementById('csv-table-upload')?.addEventListener('change', handleTableCSVUpload);
    document.getElementById('csv-index-upload')?.addEventListener('change', handleIndexCSVUpload);
    document.getElementById('csv-explain-upload')?.addEventListener('change', handleExplainCSVUpload);

    // Modal population handler (Bootstrap 5, no jQuery)
    const csvHelpBtn = document.getElementById('csvHelpModalBtn');
    if (csvHelpBtn) {
        csvHelpBtn.addEventListener('click', function() {
            populateCSVHelpModal();
            const modalEl = document.getElementById('csvHelpModal');
            if (modalEl) {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            }
        });
    }
});

// Helper: Load PapaParse if not present
function ensurePapaParse(callback) {
    if (window.Papa) return callback();
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js';
    script.onload = callback;
    document.head.appendChild(script);
}

function handleTableCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    ensurePapaParse(() => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const data = results.data;
                if (!Array.isArray(data) || data.length === 0) {
                    alert('No rows found in Table CSV.');
                    return;
                }
                // Clear existing tables
                const tablesContainer = document.getElementById('tables-container');
                tablesContainer.innerHTML = '';
                // Try to map columns
                data.forEach(row => {
                    addTable(
                        row.table_name || row.TABLE_NAME || row.name || '',
                        row.ddl || row.DDL || row['Create Table'] || '',
                        row.row_count || row.TABLE_ROWS || row.num_rows || row.rows || '',
                        row.total_size || row.total_mb || row.size || '',
                        row.has_primary_key === 'true' || row.has_primary_key === true,
                        row.primary_key_column || '',
                        row.has_foreign_key === 'true' || row.has_foreign_key === true,
                        row.foreign_key_column || '',
                        row.foreign_key_table || ''
                    );
                });
            },
            error: function(err) {
                alert('Error parsing Table CSV: ' + err.message);
            }
        });
    });
}

function handleIndexCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    ensurePapaParse(() => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const data = results.data;
                if (!Array.isArray(data) || data.length === 0) {
                    alert('No rows found in Index CSV.');
                    return;
                }
                // Clear existing indexes
                const indexesContainer = document.getElementById('indexes-container');
                indexesContainer.innerHTML = '';
                // Try to map columns
                data.forEach(row => {
                    addIndex(
                        row.index_name || row.Key_name || row.name || '',
                        row.table_name || row.Table || row.table || '',
                        row.indexdef || row.definition || row['Create Index'] || row.indexdef || '',
                        row.index_size || row.size || row.index_size_mb || ''
                    );
                });
            },
            error: function(err) {
                alert('Error parsing Index CSV: ' + err.message);
            }
        });
    });
}

function handleExplainCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    ensurePapaParse(() => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: false,
            complete: function(results) {
                const data = results.data;
                // Try to join all rows into a single string for the textarea
                let explainText = '';
                if (Array.isArray(data) && data.length > 0) {
                    // If column QUERY PLAN or Plan exists, join those
                    if (data[0]['QUERY PLAN']) {
                        explainText = data.map(r => r['QUERY PLAN']).join('\n');
                    } else if (data[0]['Plan']) {
                        explainText = data.map(r => r['Plan']).join('\n');
                    } else {
                        // Fallback: join all values
                        explainText = data.map(r => Object.values(r).join(' | ')).join('\n');
                    }
                }
                document.getElementById('explain_plan_textarea').value = explainText;
                
                // Show success message
                const feedback = document.getElementById('explain_plan_feedback');
                if (feedback) {
                    feedback.innerHTML = `<i class="fas fa-check text-success me-1"></i>EXPLAIN plan CSV loaded successfully! The visualization will be generated when you analyze the query.`;
                    feedback.style.color = '#22c55e';
                    feedback.setAttribute('aria-live', 'polite');
                }
            },
            error: function(err) {
                alert('Error parsing Explain Plan CSV: ' + err.message);
            }
        });
    });
}

function populateCSVHelpModal() {
    const helpContent = document.getElementById('csv-help-content');
    if (!helpContent) return;

    // Get user SQL and DB engine
    const sql = document.getElementById('sql_query_textarea')?.value || '';
    const dbEngine = document.getElementById('db_engine_select')?.value || 'postgresql';
    const tableNames = extractTableNames(sql);

    // Generate SQLs and columns for each section
    const modalSections = [
        generateTableSection(dbEngine, tableNames),
        generateIndexSection(dbEngine, tableNames),
        generateExplainSection(dbEngine, sql),
        generatePKSection(dbEngine, tableNames),
        generateFKSection(dbEngine, tableNames)
    ];

    // Wrap in Bootstrap 5 accordion
    helpContent.innerHTML = `
      <div class="accordion" id="csvHelpAccordion">
        ${modalSections.map((section, idx) =>
          makeCollapsible(section.title, section.sql, section.columns, idx)
        ).join('')}
      </div>
    `;
}

// Helper to get content for each section
function getSectionContent(idx, dbEngine, tableNames, sql) {
    switch(idx) {
        case 0: return [generateTableSection(dbEngine, tableNames).title, generateTableSection(dbEngine, tableNames).sql, generateTableSection(dbEngine, tableNames).columns];
        case 1: return [generateIndexSection(dbEngine, tableNames).title, generateIndexSection(dbEngine, tableNames).sql, generateIndexSection(dbEngine, tableNames).columns];
        case 2: return [generateExplainSection(dbEngine, sql).title, generateExplainSection(dbEngine, sql).sql, generateExplainSection(dbEngine, sql).columns];
        case 3: return [generatePKSection(dbEngine, tableNames).title, generatePKSection(dbEngine, tableNames).sql, generatePKSection(dbEngine, tableNames).columns];
        case 4: return [generateFKSection(dbEngine, tableNames).title, generateFKSection(dbEngine, tableNames).sql, generateFKSection(dbEngine, tableNames).columns];
        default: return ['', '', []];
    }
}

function extractTableNames(sql) {
    // Remove CTEs (everything before the main SELECT)
    let cleaned = sql.replace(/WITH[\s\S]+?\)\s*SELECT/i, 'SELECT');
    // Remove comments
    cleaned = cleaned.replace(/--.*?\n|\/\*[\s\S]*?\*\//g, ' ');
    // Find all table names after FROM or JOIN, ignoring subqueries and aliases
    const regex = /(?:FROM|JOIN)\s+([\w.\"]+)(?!\s*\))/gi;
    let match, tables = new Set();
    while ((match = regex.exec(cleaned)) !== null) {
        let t = match[1].replace(/['"`]/g, '');
        // Remove schema if present
        if (t.includes('.')) t = t.split('.')[1];
        // Ignore subqueries (starts with '(')
        if (!t.startsWith('(')) tables.add(t);
    }
    return Array.from(tables).filter(Boolean);
}

function generateTableSection(engine, tables) {
    let sql, columns;
    if (engine === 'postgresql') {
        sql = `SELECT relname AS table_name, n_live_tup AS row_count FROM pg_stat_user_tables WHERE relname IN (${tables.map(t => `'${t}'`).join(', ')});\nSELECT relname AS table_name, pg_size_pretty(pg_total_relation_size(relid)) AS total_size FROM pg_catalog.pg_statio_user_tables WHERE relname IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['table_name', 'row_count', 'total_size'];
    } else if (engine === 'mysql') {
        sql = `SELECT TABLE_NAME, TABLE_ROWS, ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS total_mb FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['TABLE_NAME', 'TABLE_ROWS', 'total_mb'];
    } else if (engine === 'sqlserver') {
        sql = `SELECT t.name AS table_name, SUM(p.rows) AS row_count FROM sys.tables t INNER JOIN sys.partitions p ON t.object_id = p.object_id WHERE t.name IN (${tables.map(t => `'${t}'`).join(', ')}) AND p.index_id IN (0,1) GROUP BY t.name;`;
        columns = ['table_name', 'row_count'];
    } else if (engine === 'oracle') {
        sql = `SELECT table_name, num_rows, ROUND((data_length + nvl(index_length,0))/1024/1024,2) AS total_mb FROM user_tables WHERE table_name IN (${tables.map(t => `'${t.toUpperCase()}'`).join(', ')});`;
        columns = ['table_name', 'num_rows', 'total_mb'];
    } else if (engine === 'sqlite') {
        sql = tables.map(t => `SELECT '${t}' AS table_name, (SELECT COUNT(*) FROM ${t}) AS row_count`).join(' UNION ALL\n');
        columns = ['table_name', 'row_count'];
    } else {
        sql = '-- Provide your table details as CSV';
        columns = [];
    }
    return {title: 'Table Details', sql, columns};
}

function generateIndexSection(engine, tables) {
    let sql, columns;
    if (engine === 'postgresql') {
        sql = `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE tablename IN (${tables.map(t => `'${t}'`).join(', ')});\nSELECT i.relname AS index_name, pg_size_pretty(pg_relation_size(i.oid)) AS index_size FROM pg_class t, pg_class i, pg_index ix WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND t.relkind = 'r' AND t.relname IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['tablename', 'indexname', 'indexdef', 'index_name', 'index_size'];
    } else if (engine === 'mysql') {
        sql = tables.map(t => `SHOW INDEX FROM ${t};`).join('\n');
        columns = ['Table', 'Non_unique', 'Key_name', 'Seq_in_index', 'Column_name', 'Collation', 'Cardinality', 'Sub_part', 'Packed', 'Null', 'Index_type', 'Comment', 'Index_comment'];
    } else if (engine === 'sqlserver') {
        sql = `SELECT t.name AS table_name, ind.name AS index_name, col.name AS column_name, ind.is_unique, ind.is_primary_key FROM sys.tables t JOIN sys.indexes ind ON t.object_id = ind.object_id JOIN sys.index_columns ic ON ind.object_id = ic.object_id AND ind.index_id = ic.index_id JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id WHERE t.name IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['table_name', 'index_name', 'column_name', 'is_unique', 'is_primary_key'];
    } else if (engine === 'oracle') {
        sql = `SELECT ind.table_name, ind.index_name, col.column_name, ind.uniqueness, ind.status, ind.tablespace_name FROM all_indexes ind JOIN all_ind_columns col ON ind.index_name = col.index_name WHERE ind.table_name IN (${tables.map(t => `'${t.toUpperCase()}'`).join(', ')});`;
        columns = ['table_name', 'index_name', 'column_name', 'uniqueness', 'status', 'tablespace_name'];
    } else if (engine === 'sqlite') {
        sql = tables.map(t => `PRAGMA index_list('${t}');`).join('\n');
        columns = ['seq', 'name', 'unique', 'origin', 'partial'];
    } else {
        sql = '-- Provide your index details as CSV';
        columns = [];
    }
    return {title: 'Index Details', sql, columns};
}

function generateExplainSection(engine, sqlQuery) {
    let sql, columns;
    if (engine === 'postgresql') {
        sql = `EXPLAIN (ANALYZE, COSTS, TIMING, FORMAT CSV)\n${sqlQuery.trim().replace(/;+$/, '')};`;
        columns = ['QUERY PLAN'];
    } else if (engine === 'mysql') {
        sql = `EXPLAIN ${sqlQuery.trim().replace(/;+$/, '')};`;
        columns = ['id', 'select_type', 'table', 'partitions', 'type', 'possible_keys', 'key', 'key_len', 'ref', 'rows', 'filtered', 'Extra'];
    } else if (engine === 'sqlserver') {
        sql = `SET SHOWPLAN_ALL ON;\n${sqlQuery.trim().replace(/;+$/, '')};\nSET SHOWPLAN_ALL OFF;`;
        columns = ['StmtText', 'StmtId', 'NodeId', 'Parent', 'PhysicalOp', 'LogicalOp', 'Argument', 'DefinedValues', 'EstimateRows', 'EstimateIO', 'EstimateCPU', 'AvgRowSize', 'TotalSubtreeCost', 'OutputList', 'Warnings', 'Type'];
    } else if (engine === 'oracle') {
        sql = `EXPLAIN PLAN FOR\n${sqlQuery.trim().replace(/;+$/, '')};\nSELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);`;
        columns = ['ID', 'OPERATION', 'OPTIONS', 'OBJECT_NAME', 'CARDINALITY', 'COST', 'BYTES', 'OTHER'];
    } else if (engine === 'sqlite') {
        sql = `EXPLAIN QUERY PLAN ${sqlQuery.trim().replace(/;+$/, '')};`;
        columns = ['id', 'parent', 'notused', 'detail'];
    } else {
        sql = '-- Provide your explain plan as CSV';
        columns = [];
    }
    return {title: 'EXPLAIN Plan (with Visualization)', sql, columns};
}

function generatePKSection(engine, tables) {
    let sql, columns;
    if (engine === 'postgresql') {
        sql = `SELECT tc.table_name, kcu.column_name AS primary_key_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['table_name', 'primary_key_column'];
    } else if (engine === 'mysql') {
        sql = `SELECT TABLE_NAME, COLUMN_NAME AS primary_key_column FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'PRIMARY' AND TABLE_NAME IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['TABLE_NAME', 'primary_key_column'];
    } else if (engine === 'sqlserver') {
        sql = `SELECT t.name AS table_name, c.name AS primary_key_column FROM sys.tables t JOIN sys.indexes i ON t.object_id = i.object_id AND i.is_primary_key = 1 JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id WHERE t.name IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['table_name', 'primary_key_column'];
    } else if (engine === 'oracle') {
        sql = `SELECT acc.table_name, acc.column_name AS primary_key_column FROM all_constraints ac JOIN all_cons_columns acc ON ac.constraint_name = acc.constraint_name WHERE ac.constraint_type = 'P' AND acc.table_name IN (${tables.map(t => `'${t.toUpperCase()}'`).join(', ')});`;
        columns = ['table_name', 'primary_key_column'];
    } else if (engine === 'sqlite') {
        sql = tables.map(t => `PRAGMA table_info('${t}');`).join('\n');
        columns = ['pk', 'name', 'type', 'notnull', 'dflt_value', 'table_name'];
    } else {
        sql = '-- Provide your primary key details as CSV';
        columns = [];
    }
    return {title: 'Primary Key Details', sql, columns};
}

function generateFKSection(engine, tables) {
    let sql, columns;
    if (engine === 'postgresql') {
        sql = `SELECT tc.table_name, kcu.column_name AS foreign_key_column, ccu.table_name AS referenced_table, ccu.column_name AS referenced_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['table_name', 'foreign_key_column', 'referenced_table', 'referenced_column'];
    } else if (engine === 'mysql') {
        sql = `SELECT TABLE_NAME, COLUMN_NAME AS foreign_key_column, REFERENCED_TABLE_NAME AS referenced_table, REFERENCED_COLUMN_NAME AS referenced_column FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL AND TABLE_NAME IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['TABLE_NAME', 'foreign_key_column', 'referenced_table', 'referenced_column'];
    } else if (engine === 'sqlserver') {
        sql = `SELECT parent.name AS table_name, c.name AS foreign_key_column, ref.name AS referenced_table, cref.name AS referenced_column FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id JOIN sys.tables parent ON fkc.parent_object_id = parent.object_id JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id JOIN sys.tables ref ON fkc.referenced_object_id = ref.object_id JOIN sys.columns cref ON fkc.referenced_object_id = cref.object_id AND fkc.referenced_column_id = cref.column_id WHERE parent.name IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['table_name', 'foreign_key_column', 'referenced_table', 'referenced_column'];
    } else if (engine === 'oracle') {
        sql = `SELECT acc.table_name, acc.column_name AS foreign_key_column, r_acc.table_name AS referenced_table, r_acc.column_name AS referenced_column FROM all_constraints ac JOIN all_cons_columns acc ON ac.constraint_name = acc.constraint_name JOIN all_constraints r_ac ON ac.r_constraint_name = r_ac.constraint_name JOIN all_cons_columns r_acc ON r_ac.constraint_name = r_acc.constraint_name AND acc.position = r_acc.position WHERE ac.constraint_type = 'R' AND acc.table_name IN (${tables.map(t => `'${t.toUpperCase()}'`).join(', ')});`;
        columns = ['table_name', 'foreign_key_column', 'referenced_table', 'referenced_column'];
    } else if (engine === 'sqlite') {
        sql = tables.map(t => `PRAGMA foreign_key_list('${t}');`).join('\n');
        columns = ['id', 'seq', 'table', 'from', 'to'];
    } else {
        sql = '-- Provide your foreign key details as CSV';
        columns = [];
    }
    return {title: 'Foreign Key Details', sql, columns};
}

function makeCollapsible(title, sql, columns, idx = 0) {
    const id = 'accordion-item-' + title.replace(/\s+/g, '-').toLowerCase();
    const headingId = id + '-heading';
    const collapseId = id + '-collapse';
    const showClass = idx === 0 ? 'show' : '';
    
    // Add special note for EXPLAIN plan visualization
    const visualizationNote = title.includes('EXPLAIN Plan') ? 
        '<div class="alert alert-info mt-2"><i class="fas fa-chart-line me-1"></i><strong>Visualization Feature:</strong> When you upload this CSV and analyze your query, you\'ll get a beautiful flowchart visualization of your execution plan!</div>' : '';
    
    return `
      <div class="accordion-item">
        <h2 class="accordion-header" id="${headingId}">
          <button class="accordion-button ${showClass ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${showClass ? 'true' : 'false'}" aria-controls="${collapseId}">
            ${title}
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse ${showClass}" aria-labelledby="${headingId}">
          <div class="accordion-body">
            <strong>SQL to run:</strong>
            <pre class="bg-light p-2">${sql}</pre>
            ${columns.length ? `<strong>Expected CSV columns:</strong><ul>${columns.map(c => `<li><code>${c}</code></li>`).join('')}</ul>` : ''}
            ${visualizationNote}
          </div>
        </div>
      </div>
    `;
}

// EXPLAIN Plan Visualization Functions
function generateExplainVisualization() {
    const explainText = document.getElementById('explain_plan_textarea').value.trim();
    const dbEngine = document.getElementById('db_engine_select').value;
    
    if (!explainText) {
        alert('Please provide an EXPLAIN plan first. You can upload a CSV file or paste the EXPLAIN output text.');
        return;
    }
    
    // Show loading state
    const container = document.getElementById('explain_visualization_container');
    const output = document.getElementById('explain_visualization_output');
    container.style.display = 'block';
    output.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin fa-2x"></i><p class="mt-2">Generating visualization...</p></div>';
    
    // Send to backend for processing
    fetch('/generate_explain_visualization', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('input[name="csrf_token"]').value
        },
        body: JSON.stringify({
            explain_plan: explainText,
            db_engine: dbEngine
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Store the Mermaid code globally for copy functionality
            window.currentMermaidCode = data.mermaid_code;
            
            // Ensure Mermaid is loaded and initialized
            ensureMermaidLoaded(() => {
                renderVisualization(data.mermaid_code);
            });
        } else {
            output.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i>Error: ${data.error}</div>`;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        output.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i>Error generating visualization. Please try again.</div>`;
    });
}

function ensureMermaidLoaded(callback) {
    if (typeof mermaid !== 'undefined' && mermaid.initialize) {
        // Mermaid is already loaded, just initialize and callback
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            flowchart: {
                useMaxWidth: false,
                htmlLabels: true
            }
        });
        callback();
    } else {
        // Load Mermaid dynamically
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mermaid@8.14.0/dist/mermaid.min.js?v=' + Date.now();
        script.onload = () => {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                flowchart: {
                    useMaxWidth: false,
                    htmlLabels: true
                }
            });
            callback();
        };
        script.onerror = () => {
            console.error('Failed to load Mermaid.js');
            document.getElementById('explain_visualization_output').innerHTML = 
                '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i>Failed to load visualization library. Please refresh the page and try again.</div>';
        };
        document.head.appendChild(script);
    }
}

function renderVisualization(mermaidCode) {
    const output = document.getElementById('explain_visualization_output');
    
    if (!output) {
        console.error('explain_visualization_output container not found');
        return;
    }
    
    // Create a unique ID for the diagram
    const diagramId = 'explain-diagram-' + Date.now();
    console.log('Generated diagram ID:', diagramId);
    
    // Clear the output and create a new container
    output.innerHTML = '';
    
    // Create the diagram container
    const diagramContainer = document.createElement('div');
    diagramContainer.id = diagramId;
    diagramContainer.className = 'mermaid';
    output.appendChild(diagramContainer);
    
    console.log('Diagram container created successfully');
    
    // Store reference to the container
    let containerRef = diagramContainer;
    
    // Use a more reliable rendering approach
    try {
        console.log('Calling mermaid.render...');
        
        // Try the promise-based approach first
        if (typeof mermaid.render === 'function') {
            const renderResult = mermaid.render(diagramId, mermaidCode);
            
            if (renderResult && typeof renderResult.then === 'function') {
                // Promise-based API
                console.log('Using Promise API');
                renderResult.then(({svg}) => {
                    console.log('Promise resolved, setting SVG...');
                    // Use stored reference instead of searching by ID
                    if (containerRef && containerRef.parentNode) {
                        containerRef.innerHTML = svg;
                        console.log('SVG set successfully');
                    } else {
                        console.error('Container reference lost');
                        showFallbackUI(mermaidCode, output);
                    }
                }).catch(error => {
                    console.error('Mermaid rendering error:', error);
                    // Try direct SVG creation as final fallback
                    try {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = `<svg width="100%" height="400" xmlns="http://www.w3.org/2000/svg">
                            <text x="10" y="30" font-family="Arial" font-size="14" fill="red">Rendering failed: ${error.message}</text>
                            <text x="10" y="60" font-family="Arial" font-size="12" fill="blue">Please use Mermaid Live Editor</text>
                        </svg>`;
                        const svgElement = tempDiv.firstElementChild;
                        if (svgElement) {
                            output.appendChild(svgElement);
                            console.log('Error SVG created and appended');
                        } else {
                            showFallbackUI(mermaidCode, output);
                        }
                    } catch (finalError) {
                        console.error('Final fallback failed:', finalError);
                        showFallbackUI(mermaidCode, output);
                    }
                });
            } else if (renderResult && renderResult.svg) {
                // Synchronous API with SVG
                console.log('Using Synchronous API with SVG');
                if (containerRef && containerRef.parentNode) {
                    containerRef.innerHTML = renderResult.svg;
                    console.log('SVG set successfully');
                } else {
                    console.error('Container reference lost');
                    showFallbackUI(mermaidCode, output);
                }
            } else {
                // Fallback: try to render directly
                console.log('Using fallback rendering approach');
                try {
                    mermaid.parse(mermaidCode);
                    const svg = mermaid.render(diagramId, mermaidCode);
                    
                    // Use stored reference immediately
                    if (containerRef && containerRef.parentNode) {
                        containerRef.innerHTML = svg;
                        console.log('Fallback SVG set successfully');
                    } else {
                        console.error('Container reference lost in fallback');
                        // Try to create SVG element directly
                        try {
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = svg;
                            const svgElement = tempDiv.firstElementChild;
                            if (svgElement) {
                                output.appendChild(svgElement);
                                console.log('SVG element created and appended directly');
                            } else {
                                throw new Error('No SVG element found');
                            }
                        } catch (directError) {
                            console.error('Direct SVG creation failed:', directError);
                            showFallbackUI(mermaidCode, output);
                        }
                    }
                } catch (fallbackError) {
                    console.error('Fallback rendering failed:', fallbackError);
                    showFallbackUI(mermaidCode, output);
                }
            }
        } else {
            throw new Error('mermaid.render is not available');
        }
    } catch (error) {
        console.error('Error in renderVisualization:', error);
        showFallbackUI(mermaidCode, output);
    }
}

function showFallbackUI(mermaidCode, container) {
    container.innerHTML = `
        <div class="alert alert-info">
            <h6><i class="fas fa-info-circle me-2"></i>Visualization Preview</h6>
            <p>The diagram couldn't be rendered automatically, but here's the Mermaid code:</p>
            <pre class="bg-light p-3 rounded">${mermaidCode}</pre>
            <p class="mb-0"><small>You can copy this code and paste it into <a href="https://mermaid.live" target="_blank">Mermaid Live Editor</a> to view the diagram.</small></p>
        </div>
    `;
}

function downloadVisualization() {
    const svg = document.querySelector('#explain_visualization_output svg');
    if (!svg) {
        alert('No visualization to download. Please generate one first.');
        return;
    }
    
    try {
        // Get SVG dimensions
        const svgRect = svg.getBoundingClientRect();
        const width = svgRect.width || 800;
        const height = svgRect.height || 600;
        
        // Create canvas with proper dimensions
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        
        // Set white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        
        // Convert SVG to data URL
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        
        const img = new Image();
        
        img.onload = function() {
            try {
                // Draw the image on canvas
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to blob and download
                canvas.toBlob(function(blob) {
                    if (blob) {
                        const downloadUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = 'explain_plan_visualization.png';
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(downloadUrl);
                        console.log('PNG download successful');
                    } else {
                        throw new Error('Failed to create blob');
                    }
                }, 'image/png', 0.95);
                
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Canvas error:', error);
                downloadAsSVG(svgData);
            }
        };
        
        img.onerror = function() {
            console.error('Image load error, falling back to SVG');
            downloadAsSVG(svgData);
            URL.revokeObjectURL(url);
        };
        
        img.src = url;
        
    } catch (error) {
        console.error('Download error:', error);
        // Final fallback: try to download as SVG
        try {
            const svgData = new XMLSerializer().serializeToString(svg);
            downloadAsSVG(svgData);
        } catch (finalError) {
            console.error('Final fallback failed:', finalError);
            alert('Download failed. Please try again or use the copy function.');
        }
    }
}

function downloadAsSVG(svgData) {
    try {
        const blob = new Blob([svgData], {type: 'image/svg+xml'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'explain_plan_visualization.svg';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('SVG download successful');
    } catch (error) {
        console.error('SVG download failed:', error);
        alert('Download failed. Please try again or use the copy function.');
    }
}

function copyVisualizationCode() {
    // Try to get the Mermaid code from the current visualization
    let mermaidCode = '';
    
    // First, try to get from the stored code (if available)
    if (window.currentMermaidCode) {
        mermaidCode = window.currentMermaidCode;
    } else {
        // Try to get from the mermaid element
        const mermaidElement = document.querySelector('#explain_visualization_output .mermaid');
        if (mermaidElement) {
            mermaidCode = mermaidElement.getAttribute('data-mermaid') || mermaidElement.textContent;
        }
    }
    
    if (!mermaidCode) {
        alert('No visualization code to copy. Please generate one first.');
        return;
    }
    
    // Try to copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(mermaidCode).then(() => {
            showCopySuccess();
        }).catch(err => {
            console.error('Failed to copy: ', err);
            fallbackCopy(mermaidCode);
        });
    } else {
        fallbackCopy(mermaidCode);
    }
}

function showCopySuccess() {
    // Find the copy button and show success message
    const copyButton = document.querySelector('button[onclick="copyVisualizationCode()"]');
    if (copyButton) {
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<i class="fas fa-check me-1"></i>Copied!';
        copyButton.classList.remove('btn-outline-secondary');
        copyButton.classList.add('btn-success');
        
        setTimeout(() => {
            copyButton.innerHTML = originalText;
            copyButton.classList.remove('btn-success');
            copyButton.classList.add('btn-outline-secondary');
        }, 2000);
    } else {
        alert('Mermaid code copied to clipboard!');
    }
}

function fallbackCopy(text) {
    // Fallback copy method
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showCopySuccess();
    } catch (err) {
        console.error('Fallback copy failed: ', err);
        alert('Failed to copy to clipboard. Please select and copy manually:\n\n' + text);
    }
    
    document.body.removeChild(textArea);
}
