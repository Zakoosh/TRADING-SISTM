-- ============================================================
-- Initial Stock Data - Seed File
-- يمكن تشغيل هذا الملف لإضافة البيانات الأولية
-- ============================================================

-- US Stocks (أسهم أمريكية)
INSERT INTO stocks (symbol, name, market, currency) VALUES
('AAPL', 'Apple Inc.', 'US', 'USD'),
('MSFT', 'Microsoft Corp.', 'US', 'USD'),
('GOOGL', 'Alphabet Inc.', 'US', 'USD'),
('AMZN', 'Amazon.com Inc.', 'US', 'USD'),
('NVDA', 'NVIDIA Corp.', 'US', 'USD'),
('META', 'Meta Platforms', 'US', 'USD'),
('TSLA', 'Tesla Inc.', 'US', 'USD'),
('JPM', 'JPMorgan Chase', 'US', 'USD'),
('V', 'Visa Inc.', 'US', 'USD'),
('WMT', 'Walmart Inc.', 'US', 'USD'),
('BAC', 'Bank of America', 'US', 'USD'),
('XOM', 'Exxon Mobil', 'US', 'USD'),
('UNH', 'UnitedHealth Group', 'US', 'USD'),
('JNJ', 'Johnson & Johnson', 'US', 'USD'),
('PG', 'Procter & Gamble', 'US', 'USD'),
('MA', 'Mastercard', 'US', 'USD'),
('HD', 'Home Depot', 'US', 'USD'),
('CVX', 'Chevron', 'US', 'USD'),
('KO', 'Coca-Cola', 'US', 'USD'),
('PEP', 'PepsiCo', 'US', 'USD'),
('NFLX', 'Netflix', 'US', 'USD'),
('DIS', 'Walt Disney', 'US', 'USD'),
('INTC', 'Intel Corp.', 'US', 'USD'),
('AMD', 'AMD', 'US', 'USD'),
('CSCO', 'Cisco Systems', 'US', 'USD')
ON CONFLICT (symbol) DO NOTHING;

-- Turkish Stocks (أسهم تركية)
INSERT INTO stocks (symbol, name, market, currency) VALUES
('GARAN.IS', 'Garanti Bankası', 'TR', 'TRY'),
('AKBNK.IS', 'Akbank', 'TR', 'TRY'),
('THYAO.IS', 'Türk Hava Yolları', 'TR', 'TRY'),
('EREGL.IS', 'Ereğli Demir Çelik', 'TR', 'TRY'),
('SISE.IS', 'Şişecam', 'TR', 'TRY'),
('BIMAS.IS', 'BIM Birleşik Mağazalar', 'TR', 'TRY'),
('ARCLK.IS', 'Arçelik A.Ş.', 'TR', 'TRY'),
('KCHOL.IS', 'Koç Holding', 'TR', 'TRY'),
('TCELL.IS', 'Turkcell', 'TR', 'TRY'),
('SAHOL.IS', 'Sabancı Holding', 'TR', 'TRY'),
('TUPRS.IS', 'Tüpraş', 'TR', 'TRY'),
('PETKM.IS', 'Petkim', 'TR', 'TRY'),
('PGSUS.IS', 'Pegasus', 'TR', 'TRY'),
('ASELS.IS', 'Aselsan', 'TR', 'TRY'),
('TAVHL.IS', 'TAV Havalimanları', 'TR', 'TRY')
ON CONFLICT (symbol) DO NOTHING;

-- Cryptocurrencies (عملات رقمية)
INSERT INTO stocks (symbol, name, market, currency) VALUES
('BTC/USD', 'Bitcoin', 'CRYPTO', 'USD'),
('ETH/USD', 'Ethereum', 'CRYPTO', 'USD'),
('BNB/USD', 'BNB', 'CRYPTO', 'USD'),
('SOL/USD', 'Solana', 'CRYPTO', 'USD'),
('XRP/USD', 'XRP', 'CRYPTO', 'USD'),
('ADA/USD', 'Cardano', 'CRYPTO', 'USD'),
('DOGE/USD', 'Dogecoin', 'CRYPTO', 'USD'),
('AVAX/USD', 'Avalanche', 'CRYPTO', 'USD'),
('DOT/USD', 'Polkadot', 'CRYPTO', 'USD'),
('MATIC/USD', 'Polygon', 'CRYPTO', 'USD'),
('LINK/USD', 'Chainlink', 'CRYPTO', 'USD'),
('UNI/USD', 'Uniswap', 'CRYPTO', 'USD')
ON CONFLICT (symbol) DO NOTHING;

-- Commodities (سلع)
INSERT INTO stocks (symbol, name, market, currency) VALUES
('XAU/USD', 'Gold', 'COMMODITY', 'USD'),
('XAG/USD', 'Silver', 'COMMODITY', 'USD'),
('WTI/USD', 'Crude Oil WTI', 'COMMODITY', 'USD'),
('BRENT', 'Brent Oil', 'COMMODITY', 'USD'),
('XPT/USD', 'Platinum', 'COMMODITY', 'USD'),
('XPD/USD', 'Palladium', 'COMMODITY', 'USD'),
('NG', 'Natural Gas', 'COMMODITY', 'USD'),
('HG', 'Copper', 'COMMODITY', 'USD')
ON CONFLICT (symbol) DO NOTHING;

-- Indices (مؤشرات)
INSERT INTO stocks (symbol, name, market, currency) VALUES
('SPX', 'S&P 500', 'INDEX', 'USD'),
('DJI', 'Dow Jones', 'INDEX', 'USD'),
('IXIC', 'NASDAQ', 'INDEX', 'USD'),
('FTSE', 'FTSE 100', 'INDEX', 'GBP'),
('DAX', 'DAX', 'INDEX', 'EUR'),
('XU100', 'BIST 100', 'INDEX', 'TRY'),
('CAC', 'CAC 40', 'INDEX', 'EUR'),
('N225', 'Nikkei 225', 'INDEX', 'JPY')
ON CONFLICT (symbol) DO NOTHING;

-- Additional US Stocks (توسعة الأسهم الأمريكية)
INSERT INTO stocks (symbol, name, market, currency) VALUES
('ORCL', 'Oracle Corporation', 'US', 'USD'),
('CRM', 'Salesforce Inc.', 'US', 'USD'),
('ADBE', 'Adobe Inc.', 'US', 'USD'),
('PYPL', 'PayPal Holdings', 'US', 'USD'),
('NKE', 'Nike Inc.', 'US', 'USD'),
('COST', 'Costco Wholesale', 'US', 'USD'),
('ABBV', 'AbbVie Inc.', 'US', 'USD'),
('MRK', 'Merck & Co.', 'US', 'USD'),
('PFE', 'Pfizer Inc.', 'US', 'USD'),
('TMO', 'Thermo Fisher Scientific', 'US', 'USD'),
('MCD', 'McDonald''s Corp.', 'US', 'USD'),
('QCOM', 'Qualcomm Inc.', 'US', 'USD'),
('TXN', 'Texas Instruments', 'US', 'USD'),
('AVGO', 'Broadcom Inc.', 'US', 'USD'),
('AMAT', 'Applied Materials', 'US', 'USD')
ON CONFLICT (symbol) DO NOTHING;

-- Additional Turkish Stocks (توسعة الأسهم التركية)
INSERT INTO stocks (symbol, name, market, currency) VALUES
('ISCTR.IS', 'İş Bankası (C)', 'TR', 'TRY'),
('YKBNK.IS', 'Yapı Kredi Bankası', 'TR', 'TRY'),
('HALKB.IS', 'Halkbank', 'TR', 'TRY'),
('KRDMD.IS', 'Kardemir (D)', 'TR', 'TRY'),
('KOZAL.IS', 'Koza Altın', 'TR', 'TRY'),
('ENKAI.IS', 'Enka İnşaat', 'TR', 'TRY'),
('FROTO.IS', 'Ford Otosan', 'TR', 'TRY'),
('OTKAR.IS', 'Otokar', 'TR', 'TRY'),
('DOHOL.IS', 'Doğan Holding', 'TR', 'TRY'),
('VESTL.IS', 'Vestel', 'TR', 'TRY')
ON CONFLICT (symbol) DO NOTHING;

-- Additional Crypto (توسعة العملات الرقمية)
INSERT INTO stocks (symbol, name, market, currency) VALUES
('LTC/USD', 'Litecoin', 'CRYPTO', 'USD'),
('BCH/USD', 'Bitcoin Cash', 'CRYPTO', 'USD'),
('ATOM/USD', 'Cosmos', 'CRYPTO', 'USD'),
('FIL/USD', 'Filecoin', 'CRYPTO', 'USD'),
('NEAR/USD', 'NEAR Protocol', 'CRYPTO', 'USD'),
('APT/USD', 'Aptos', 'CRYPTO', 'USD'),
('ARB/USD', 'Arbitrum', 'CRYPTO', 'USD'),
('OP/USD', 'Optimism', 'CRYPTO', 'USD')
ON CONFLICT (symbol) DO NOTHING;

-- Additional Commodities (توسعة السلع)
INSERT INTO stocks (symbol, name, market, currency) VALUES
('NATGAS/USD', 'Natural Gas Spot', 'COMMODITY', 'USD'),
('COPPER/USD', 'Copper Spot', 'COMMODITY', 'USD'),
('COCOA/USD', 'Cocoa', 'COMMODITY', 'USD'),
('SUGAR/USD', 'Sugar', 'COMMODITY', 'USD')
ON CONFLICT (symbol) DO NOTHING;

-- Additional Indices (توسعة المؤشرات)
INSERT INTO stocks (symbol, name, market, currency) VALUES
('RUT', 'Russell 2000', 'INDEX', 'USD'),
('STOXX50', 'EURO STOXX 50', 'INDEX', 'EUR'),
('IBEX', 'IBEX 35', 'INDEX', 'EUR'),
('SSEC', 'Shanghai Composite', 'INDEX', 'CNY'),
('HSI', 'Hang Seng Index', 'INDEX', 'HKD')
ON CONFLICT (symbol) DO NOTHING;
