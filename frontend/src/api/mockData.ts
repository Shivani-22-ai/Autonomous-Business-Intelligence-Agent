/**
 * Mock data fixtures for development/demo when backend is not running.
 * All values here are synthetic — never presented as live AI results.
 */
import type {
  Dataset,
  DatasetProfile,
  AnalysisResult,
  Report,
  UploadResponse,
} from '@/types'

// ─── Synthetic demo dataset (matches 06_VERIFICATION_DEMO.md spec) ────────

export const MOCK_UPLOAD_RESPONSE: UploadResponse = {
  dataset_id: 'demo-dataset-001',
  filename: 'business_sales_demo.csv',
  file_type: 'csv',
  row_count: 1240,
  column_count: 9,
  created_at: new Date(Date.now() - 60_000).toISOString(),
}

export const MOCK_DATASETS: Dataset[] = [
  {
    dataset_id: 'demo-dataset-001',
    filename: 'business_sales_demo.csv',
    file_type: 'csv',
    row_count: 1240,
    column_count: 9,
    created_at: new Date(Date.now() - 60_000).toISOString(),
  },
]

export const MOCK_DATA_ROWS_DEMO: Record<string, any>[] = [
  { order_id: 'ORD-0001', order_date: '2024-01-03', region: 'North', product: 'Laptop Pro', customer_segment: 'Enterprise', units: 5, revenue: 12499.95, cost: 8500.00, profit: 3999.95 },
  { order_id: 'ORD-0002', order_date: '2024-01-07', region: 'South', product: 'Desk Chair', customer_segment: 'SMB', units: 4, revenue: 1800.00, cost: 1200.00, profit: 600.00 },
  { order_id: 'ORD-0003', order_date: '2024-01-12', region: 'East', product: 'Monitor 27"', customer_segment: 'Consumer', units: 2, revenue: 900.00, cost: 600.00, profit: 300.00 },
  { order_id: 'ORD-0004', order_date: '2024-02-04', region: 'West', product: 'Laptop Pro', customer_segment: 'Enterprise', units: 3, revenue: 7499.97, cost: 5100.00, profit: 2399.97 },
  { order_id: 'ORD-0005', order_date: '2024-02-18', region: 'North', product: 'Wireless Mouse', customer_segment: 'Consumer', units: 10, revenue: 499.90, cost: 250.00, profit: 249.90 },
  { order_id: 'ORD-0006', order_date: '2024-03-02', region: 'East', product: 'Laptop Pro', customer_segment: 'Enterprise', units: 6, revenue: 14999.94, cost: 10200.00, profit: 4799.94 },
  { order_id: 'ORD-0007', order_date: '2024-03-15', region: 'South', product: 'Monitor 27"', customer_segment: 'SMB', units: 3, revenue: 1350.00, cost: 900.00, profit: 450.00 },
  { order_id: 'ORD-0008', order_date: '2024-04-10', region: 'West', product: 'Desk Chair', customer_segment: 'SMB', units: 8, revenue: 3600.00, cost: 2400.00, profit: 1200.00 },
  { order_id: 'ORD-0009', order_date: '2024-04-22', region: 'North', product: 'Monitor 27"', customer_segment: 'Enterprise', units: 5, revenue: 2250.00, cost: 1500.00, profit: 750.00 },
  { order_id: 'ORD-0010', order_date: '2024-05-05', region: 'East', product: 'Desk Chair', customer_segment: 'Consumer', units: 2, revenue: 900.00, cost: 600.00, profit: 300.00 },
  { order_id: 'ORD-0011', order_date: '2024-05-19', region: 'South', product: 'Laptop Pro', customer_segment: 'Enterprise', units: 4, revenue: 9999.96, cost: 6800.00, profit: 3199.96 },
  { order_id: 'ORD-0012', order_date: '2024-06-08', region: 'West', product: 'Wireless Mouse', customer_segment: 'Consumer', units: 15, revenue: 749.85, cost: 375.00, profit: 374.85 },
  { order_id: 'ORD-0013', order_date: '2024-06-25', region: 'North', product: 'Desk Chair', customer_segment: 'Enterprise', units: 12, revenue: 5400.00, cost: 3600.00, profit: 1800.00 },
  { order_id: 'ORD-0014', order_date: '2024-07-11', region: 'East', product: 'Monitor 27"', customer_segment: 'SMB', units: 4, revenue: 1800.00, cost: 1200.00, profit: 600.00 },
  { order_id: 'ORD-0015', order_date: '2024-07-29', region: 'South', product: 'Wireless Mouse', customer_segment: 'SMB', units: 8, revenue: 399.92, cost: 200.00, profit: 199.92 },
  { order_id: 'ORD-0016', order_date: '2024-08-14', region: 'West', product: 'Laptop Pro', customer_segment: 'Enterprise', units: 5, revenue: 12499.95, cost: 8500.00, profit: 3999.95 },
  { order_id: 'ORD-0017', order_date: '2024-08-27', region: 'North', product: 'Laptop Pro', customer_segment: 'SMB', units: 2, revenue: 4999.98, cost: 3400.00, profit: 1599.98 },
  { order_id: 'ORD-0018', order_date: '2024-09-09', region: 'East', product: 'Wireless Mouse', customer_segment: 'Consumer', units: 20, revenue: 999.80, cost: 500.00, profit: 499.80 },
  { order_id: 'ORD-0019', order_date: '2024-09-23', region: 'South', product: 'Desk Chair', customer_segment: 'Enterprise', units: 6, revenue: 2700.00, cost: 1800.00, profit: 900.00 },
  { order_id: 'ORD-0020', order_date: '2024-10-12', region: 'West', product: 'Monitor 27"', customer_segment: 'Consumer', units: 3, revenue: 1350.00, cost: 900.00, profit: 450.00 },
  { order_id: 'ORD-0021', order_date: '2024-10-28', region: 'North', product: 'Laptop Pro', customer_segment: 'Enterprise', units: 8, revenue: 19999.92, cost: 13600.00, profit: 6399.92 },
  { order_id: 'ORD-0022', order_date: '2024-11-15', region: 'East', product: 'Laptop Pro', customer_segment: 'Enterprise', units: 10, revenue: 24999.90, cost: 17000.00, profit: 7999.90 },
  { order_id: 'ORD-0023', order_date: '2024-11-29', region: 'West', product: 'Desk Chair', customer_segment: 'SMB', units: 5, revenue: 2250.00, cost: 1500.00, profit: 750.00 },
  { order_id: 'ORD-0024', order_date: '2024-12-10', region: 'South', product: 'Monitor 27"', customer_segment: 'Consumer', units: 2, revenue: 900.00, cost: 600.00, profit: 300.00 },
  { order_id: 'ORD-0025', order_date: '2024-12-22', region: 'North', product: 'Wireless Mouse', customer_segment: 'Enterprise', units: 25, revenue: 1249.75, cost: 625.00, profit: 624.75 },
]

export const MOCK_PROFILE: DatasetProfile = {
  dataset_id: 'demo-dataset-001',
  filename: 'business_sales_demo.csv',
  row_count: 1240,
  column_count: 9,
  quality_summary: {
    overall_score: 87,
    warnings: [
      '3 rows have missing cost values (0.2%)',
      'order_date column has mixed date formats in 7 rows',
    ],
    critical_issues: [],
  },
  schema: [
    { name: 'order_id', inferred_type: 'categorical', nullable: false, unique_count: 1240, missing_count: 0, missing_pct: 0, sample_values: ['ORD-0001', 'ORD-0002', 'ORD-0003'] },
    { name: 'order_date', inferred_type: 'date', nullable: false, unique_count: 365, missing_count: 0, missing_pct: 0, sample_values: ['2024-01-03', '2024-01-07', '2024-01-12'] },
    { name: 'region', inferred_type: 'categorical', nullable: false, unique_count: 4, missing_count: 0, missing_pct: 0, sample_values: ['North', 'South', 'East', 'West'] },
    { name: 'product', inferred_type: 'categorical', nullable: false, unique_count: 12, missing_count: 0, missing_pct: 0, sample_values: ['Laptop Pro', 'Desk Chair', 'Monitor 27"'] },
    { name: 'customer_segment', inferred_type: 'categorical', nullable: false, unique_count: 3, missing_count: 0, missing_pct: 0, sample_values: ['Enterprise', 'SMB', 'Consumer'] },
    { name: 'units', inferred_type: 'numeric', nullable: false, unique_count: 28, missing_count: 0, missing_pct: 0, sample_values: [2, 5, 1, 10], min: 1, max: 50, mean: 4.2, std: 3.8 },
    { name: 'revenue', inferred_type: 'numeric', nullable: false, unique_count: 820, missing_count: 0, missing_pct: 0, sample_values: [2499.99, 450.00, 1200.00], min: 49.99, max: 24999.99, mean: 3842.17, std: 2190.44 },
    { name: 'cost', inferred_type: 'numeric', nullable: false, unique_count: 812, missing_count: 3, missing_pct: 0.2, sample_values: [1800.00, 300.00, 850.00], min: 30.00, max: 18000.00, mean: 2680.55, std: 1530.22 },
    { name: 'profit', inferred_type: 'numeric', nullable: false, unique_count: 816, missing_count: 3, missing_pct: 0.2, sample_values: [699.99, 150.00, 350.00], min: -120.00, max: 6999.99, mean: 1161.62, std: 780.12 },
  ],
  created_at: new Date(Date.now() - 60_000).toISOString(),
}

export const MOCK_ANALYSIS_RESULTS: AnalysisResult[] = [
  {
    result_id: 'result-001',
    dataset_id: 'demo-dataset-001',
    question: 'Which region has the highest revenue?',
    status: 'success',
    tool: 'run_safe_sql',
    reason: 'Question asks for a ranking by aggregate metric across a categorical dimension; safe SQL GROUP BY is appropriate.',
    insights: [
      { label: 'Top Region', value: 'North', unit: '' },
      { label: 'North Revenue', value: 1847203, unit: '$', delta: 12.4, delta_label: 'vs last period' },
      { label: 'Runner-up', value: 'East', unit: '' },
      { label: 'East Revenue', value: 1643890, unit: '$' },
    ],
    chart_spec: {
      type: 'bar',
      title: 'Revenue by Region',
      x_key: 'region',
      y_keys: ['revenue'],
      x_label: 'Region',
      y_label: 'Revenue ($)',
      data: [
        { region: 'North', revenue: 1847203 },
        { region: 'East', revenue: 1643890 },
        { region: 'West', revenue: 1389440 },
        { region: 'South', revenue: 1122670 },
      ],
    },
    warnings: [],
    created_at: new Date(Date.now() - 300_000).toISOString(),
    completed_at: new Date(Date.now() - 298_000).toISOString(),
    sql_query: 'SELECT region, SUM(revenue) AS revenue FROM dataset GROUP BY region ORDER BY revenue DESC',
  },
  {
    result_id: 'result-002',
    dataset_id: 'demo-dataset-001',
    question: 'Show monthly revenue growth.',
    status: 'success',
    tool: 'detect_trends',
    reason: 'Time-series trend detection across monthly aggregated revenue.',
    insights: [
      { label: 'Peak Month', value: 'November 2024', unit: '' },
      { label: 'Peak Revenue', value: 628441, unit: '$' },
      { label: 'Average MoM Growth', value: 3.2, unit: '%' },
      { label: 'Trend Direction', value: 'Upward', unit: '' },
    ],
    chart_spec: {
      type: 'area',
      title: 'Monthly Revenue Trend',
      x_key: 'month',
      y_keys: ['revenue'],
      x_label: 'Month',
      y_label: 'Revenue ($)',
      data: [
        { month: 'Jan', revenue: 412000 },
        { month: 'Feb', revenue: 398000 },
        { month: 'Mar', revenue: 431000 },
        { month: 'Apr', revenue: 455000 },
        { month: 'May', revenue: 478000 },
        { month: 'Jun', revenue: 491000 },
        { month: 'Jul', revenue: 502000 },
        { month: 'Aug', revenue: 528000 },
        { month: 'Sep', revenue: 543000 },
        { month: 'Oct', revenue: 589000 },
        { month: 'Nov', revenue: 628441 },
        { month: 'Dec', revenue: 607000 },
      ],
    },
    warnings: [],
    created_at: new Date(Date.now() - 600_000).toISOString(),
    completed_at: new Date(Date.now() - 597_000).toISOString(),
  },
  {
    result_id: 'result-003',
    dataset_id: 'demo-dataset-001',
    question: 'Find unusual transactions.',
    status: 'success',
    tool: 'detect_anomalies',
    reason: 'Isolation Forest applied to numeric features: revenue, cost, units. Contamination=0.05.',
    insights: [
      { label: 'Anomalies Found', value: 14, unit: 'records' },
      { label: 'Anomaly Rate', value: 1.1, unit: '%' },
      { label: 'Largest Deviation', value: 'ORD-0748 — $24,999 revenue', unit: '' },
    ],
    chart_spec: {
      type: 'scatter',
      title: 'Revenue vs Profit (Anomalies Highlighted)',
      x_key: 'revenue',
      y_keys: ['profit'],
      x_label: 'Revenue ($)',
      y_label: 'Profit ($)',
      data: [
        { revenue: 1200, profit: 400, anomaly: 0 },
        { revenue: 2500, profit: 800, anomaly: 0 },
        { revenue: 3800, profit: 1200, anomaly: 0 },
        { revenue: 5100, profit: 1600, anomaly: 0 },
        { revenue: 6400, profit: 2100, anomaly: 0 },
        { revenue: 24999, profit: 6999, anomaly: 1 },
        { revenue: 450, profit: -120, anomaly: 1 },
        { revenue: 8200, profit: 2800, anomaly: 0 },
        { revenue: 7100, profit: 2300, anomaly: 0 },
      ],
      anomaly_markers: [
        { index: 5, label: 'ORD-0748', value: 24999 },
        { index: 6, label: 'ORD-0312', value: 450 },
      ],
    },
    warnings: [
      { code: 'ANOMALY_THRESHOLD', message: 'Contamination parameter set to 0.05. Adjust if business context differs.', severity: 'info' },
    ],
    created_at: new Date(Date.now() - 900_000).toISOString(),
    completed_at: new Date(Date.now() - 895_000).toISOString(),
  },
]

export const MOCK_REPORT: Report = {
  report_id: 'report-001',
  dataset_id: 'demo-dataset-001',
  status: 'ready',
  title: 'Business Intelligence Executive Report — business_sales_demo.csv',
  executive_summary:
    'Analysis of 1,240 sales records across 4 regions and 12 products for 2024 reveals steady revenue growth averaging 3.2% month-over-month. The North region leads with $1.85M in total revenue. Fourteen anomalous transactions were detected, representing 1.1% of orders. Profitability is strong with an average profit margin of 30.2%, though three cost records require remediation.',
  kpis: [
    { label: 'Total Revenue', value: 6003203, unit: '$', change: 18.4, change_label: 'vs prior year', trend: 'up' },
    { label: 'Total Profit', value: 1441617, unit: '$', change: 14.2, change_label: 'vs prior year', trend: 'up' },
    { label: 'Avg Profit Margin', value: 30.2, unit: '%', trend: 'neutral' },
    { label: 'Total Orders', value: 1240, unit: '', trend: 'up' },
    { label: 'Anomalous Records', value: 14, unit: '', change: 0, change_label: '', trend: 'neutral' },
    { label: 'Data Quality Score', value: 87, unit: '/100', trend: 'up' },
  ],
  trend_findings: [
    {
      id: 'trend-1',
      title: 'Revenue Growth Acceleration in Q4',
      content: 'Monthly revenue grew from $412,000 in January to a peak of $628,441 in November, representing 52.5% growth over the year. Q4 (Oct–Dec) accounted for 30.4% of annual revenue, suggesting strong seasonal demand.',
    },
    {
      id: 'trend-2',
      title: 'North Region Consistent Leadership',
      content: 'The North region maintained the highest revenue share in 10 of 12 months, with a particularly strong Q3 performance (+22% vs Q2). East region closed the gap in Q4.',
    },
  ],
  anomaly_findings: [
    {
      id: 'anomaly-1',
      title: '14 Anomalous Transactions Detected',
      content: 'Isolation Forest (contamination=0.05) identified 14 records with unusual revenue/cost/units combinations. The most notable is ORD-0748 with $24,999 revenue, significantly above the dataset mean of $3,842. Manual review is recommended.',
    },
    {
      id: 'anomaly-2',
      title: 'Negative Profit Outlier',
      content: 'ORD-0312 recorded a revenue of $450 against a cost of $570, resulting in a -$120 loss. This may indicate a mis-priced promotional order or a data entry error.',
    },
  ],
  chart_specs: [
    MOCK_ANALYSIS_RESULTS[1].chart_spec!,
    MOCK_ANALYSIS_RESULTS[0].chart_spec!,
  ],
  recommendations: [
    { id: 'rec-1', title: 'Investigate Anomalous Orders', content: 'Review the 14 flagged transactions with the operations team to determine if they represent data errors, exceptional deals, or pricing issues.' },
    { id: 'rec-2', title: 'Replicate North Region Strategy', content: 'The North region\'s revenue leadership and margin profile suggest best-practice sales and product mix. Analyze what differentiates North and consider applying those practices in South (lowest revenue).' },
    { id: 'rec-3', title: 'Remediate Missing Cost Data', content: '3 records have missing cost values. Imputation or manual correction is required before these rows can be included in profitability analysis.' },
  ],
  data_quality_warnings: [
    '3 rows have missing cost values (0.2%)',
    'order_date column has mixed date formats in 7 rows — normalized to ISO 8601 for analysis',
  ],
  generated_at: new Date().toISOString(),
}
