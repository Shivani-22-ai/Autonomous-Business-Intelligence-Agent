"""
Script to generate deterministic synthetic business dataset for testing and demonstration.
Includes known seeded anomalies for anomaly detection verification.
"""

import os
import numpy as np
import pandas as pd

def generate_synthetic_data(output_path: str = "data/fixtures/synthetic_business_data.csv", n_rows: int = 250) -> pd.DataFrame:
    np.random.seed(42)
    
    # Date range: 2023-01-01 to 2023-12-31
    dates = pd.date_range(start="2023-01-01", end="2023-12-31", freq="D")
    sampled_dates = np.random.choice(dates, size=n_rows)
    sampled_dates.sort()
    
    regions = ["North America", "Europe", "Asia-Pacific", "Latin America"]
    region_probs = [0.40, 0.30, 0.20, 0.10]
    
    products = ["Enterprise Suite", "Professional Plan", "Starter Bundle", "Add-on Module"]
    product_base_prices = {
        "Enterprise Suite": 1200.0,
        "Professional Plan": 450.0,
        "Starter Bundle": 150.0,
        "Add-on Module": 75.0,
    }
    product_margins = {
        "Enterprise Suite": 0.65,
        "Professional Plan": 0.55,
        "Starter Bundle": 0.45,
        "Add-on Module": 0.70,
    }
    
    segments = ["Enterprise", "Mid-Market", "Small Business"]
    segment_probs = [0.30, 0.45, 0.25]
    
    sampled_regions = np.random.choice(regions, size=n_rows, p=region_probs)
    sampled_products = np.random.choice(products, size=n_rows)
    sampled_segments = np.random.choice(segments, size=n_rows, p=segment_probs)
    
    data = []
    for i in range(n_rows):
        order_id = f"ORD-2023-{i+1:04d}"
        order_date = pd.Timestamp(sampled_dates[i]).strftime("%Y-%m-%d")
        region = sampled_regions[i]
        prod = sampled_products[i]
        segment = sampled_segments[i]
        
        # Regular units based on segment
        if segment == "Enterprise":
            units = int(np.random.randint(5, 25))
        elif segment == "Mid-Market":
            units = int(np.random.randint(2, 10))
        else:
            units = int(np.random.randint(1, 4))
            
        base_price = product_base_prices[prod]
        unit_price = round(base_price * np.random.uniform(0.90, 1.10), 2)
        revenue = round(units * unit_price, 2)
        
        # Cost and Profit
        margin = product_margins[prod] * np.random.uniform(0.92, 1.05)
        cost = round(revenue * (1.0 - margin), 2)
        profit = round(revenue - cost, 2)
        
        data.append({
            "order_id": order_id,
            "order_date": order_date,
            "region": region,
            "product": prod,
            "customer_segment": segment,
            "units": units,
            "revenue": revenue,
            "cost": cost,
            "profit": profit
        })
        
    df = pd.DataFrame(data)
    
    # Inject 4 specific deterministic anomalies:
    # 1. Extreme Volume & Revenue Anomaly
    df.loc[45, "units"] = 350
    df.loc[45, "revenue"] = 420000.00
    df.loc[45, "cost"] = 150000.00
    df.loc[45, "profit"] = 270000.00
    
    # 2. Severe Negative Profit Margin Anomaly (Massive loss)
    df.loc[112, "units"] = 20
    df.loc[112, "revenue"] = 3000.00
    df.loc[112, "cost"] = 48000.00
    df.loc[112, "profit"] = -45000.00
    
    # 3. High Unit count with Zero Revenue Anomaly (Free giveaway error)
    df.loc[180, "units"] = 80
    df.loc[180, "revenue"] = 10.00
    df.loc[180, "cost"] = 8500.00
    df.loc[180, "profit"] = -8490.00
    
    # 4. Extreme Cost Anomaly with Normal Revenue
    df.loc[220, "units"] = 8
    df.loc[220, "revenue"] = 9600.00
    df.loc[220, "cost"] = 95000.00
    df.loc[220, "profit"] = -85400.00

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"Generated {len(df)} rows to {output_path}")
    return df

if __name__ == "__main__":
    generate_synthetic_data()
