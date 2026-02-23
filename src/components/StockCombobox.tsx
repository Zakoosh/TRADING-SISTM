import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { searchStocks, fetchStocksByMarket, fetchAllStocks, StockData, isSupabaseConfigured } from '@/lib/supabase'
import { DEFAULT_STOCKS } from '@/lib/marketData'
import { MarketType } from '@/types'

const MARKET_LABELS: Record<MarketType, string> = {
  US: '🇺🇸 أمريكا',
  TR: '🇹🇷 تركيا',
  CRYPTO: '💎 عملات رقمية',
  COMMODITY: '🥇 سلع',
  INDEX: '📊 مؤشرات',
}

interface StockComboboxProps {
  value?: string
  onSelect: (symbol: string, name: string, market: MarketType) => void
  excludeSymbols?: string[]
  selectedMarket?: MarketType
}

export function StockCombobox({ value, onSelect, excludeSymbols = [], selectedMarket }: StockComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stocks, setStocks] = useState<StockData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!open) return
    loadStocks()
  }, [selectedMarket, debouncedSearch, open])

  const getDefaultStocks = (): StockData[] => {
    if (selectedMarket) {
      return DEFAULT_STOCKS[selectedMarket].map(s => ({
        id: s.symbol,
        symbol: s.symbol,
        name: s.name,
        market: selectedMarket,
        currency: s.currency,
        is_active: true,
      }))
    }

    return (Object.entries(DEFAULT_STOCKS) as Array<[MarketType, Array<{ symbol: string; name: string; currency: string }>]>).flatMap(
      ([market, items]) =>
        items.map(s => ({
          id: s.symbol,
          symbol: s.symbol,
          name: s.name,
          market,
          currency: s.currency,
          is_active: true,
        }))
    )
  }

  const loadStocks = async () => {
    setLoading(true)
    try {
      const defaultStocks = getDefaultStocks()

      if (isSupabaseConfigured()) {
        // جلب من قاعدة البيانات
        const data = debouncedSearch.length > 0
          ? await searchStocks(debouncedSearch, selectedMarket, 100)
          : selectedMarket 
            ? await fetchStocksByMarket(selectedMarket, 120)
            : await fetchAllStocks(120)

        if (data.length > 0) {
          setStocks(data)
        } else {
          const filtered = debouncedSearch.length > 0
            ? defaultStocks.filter(s =>
                s.symbol.toLowerCase().includes(debouncedSearch.toLowerCase())
              )
            : defaultStocks
          setStocks(filtered)
        }
      } else {
        // استخدام البيانات الافتراضية
        const filtered = debouncedSearch.length > 0
          ? defaultStocks.filter(s => 
              s.symbol.toLowerCase().includes(debouncedSearch.toLowerCase())
            )
          : defaultStocks
        
        setStocks(filtered)
      }
    } catch (error) {
      console.error('Error loading stocks:', error)
      const defaultStocks = getDefaultStocks()
      const filtered = debouncedSearch.length > 0
        ? defaultStocks.filter(s =>
            s.symbol.toLowerCase().includes(debouncedSearch.toLowerCase())
          )
        : defaultStocks
      setStocks(filtered)
    } finally {
      setLoading(false)
    }
  }

  const availableStocks = stocks.filter(s => !excludeSymbols.includes(s.symbol))

  const handleChooseStock = (stock: StockData) => {
    onSelect(stock.symbol, stock.name, stock.market)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value ? value : "اختر سهم أو اكتب للبحث..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="ابحث عن سهم..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? 'جاري التحميل...' : 'لم يتم العثور على أسهم'}
            </CommandEmpty>
            <CommandGroup>
              {availableStocks.map((stock) => (
                <CommandItem
                  key={stock.symbol}
                  value={stock.symbol}
                  onSelect={() => handleChooseStock(stock)}
                  onClick={() => handleChooseStock(stock)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Check
                      className={cn(
                        "ml-2 h-4 w-4",
                        value === stock.symbol ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col items-end">
                      <span className="font-medium">{stock.name}</span>
                      <span className="text-xs text-muted-foreground">{stock.symbol}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {MARKET_LABELS[stock.market]}
                    </Badge>
                    <button
                      type="button"
                      aria-label={`إضافة ${stock.symbol}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-green-500 hover:bg-accent"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleChooseStock(stock)
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
