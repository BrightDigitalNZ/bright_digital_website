/** @jsxImportSource preact */
import { useMemo, useState } from 'preact/hooks';

const fmt = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString('en-NZ', { maximumFractionDigits: 0 }) : '0';
const money = (n: number) => '$' + fmt(n);

interface FieldProps {
  label: string;
  hint?: string;
  value: number;
  step?: number;
  min?: number;
  onInput: (n: number) => void;
}

function Field({ label, hint, value, step = 1, min = 0, onInput }: FieldProps) {
  return (
    <label class="calc-field">
      <span class="calc-field-label">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={String(value)}
        step={step}
        min={min}
        onInput={(e) => {
          const v = parseFloat((e.target as HTMLInputElement).value);
          onInput(Number.isFinite(v) ? v : 0);
        }}
      />
      {hint && <span class="calc-field-hint">{hint}</span>}
    </label>
  );
}

interface ResultProps {
  label: string;
  value: string;
  emphasis?: boolean;
}

function Result({ label, value, emphasis = false }: ResultProps) {
  return (
    <div class={`calc-result ${emphasis ? 'calc-result-emphasis' : ''}`}>
      <span class="calc-result-label">{label}</span>
      <span class="calc-result-value">{value}</span>
    </div>
  );
}

export default function ROASCalculator() {
  const [spend, setSpend] = useState(5000);
  const [revenue, setRevenue] = useState(25000);
  const [margin, setMargin] = useState(40);
  const [orders, setOrders] = useState(50);

  const results = useMemo(() => {
    const roas = spend > 0 ? revenue / spend : 0;
    const grossProfit = (revenue * margin) / 100;
    const netProfit = grossProfit - spend;
    const cpa = orders > 0 ? Math.round(spend / orders) : 0;
    const rpo = orders > 0 ? Math.round(revenue / orders) : 0;
    const ppo = orders > 0 ? Math.round(grossProfit / orders) : 0;
    return { roas, grossProfit, netProfit, cpa, rpo, ppo };
  }, [spend, revenue, margin, orders]);

  return (
    <div class="calc">
      <form class="calc-form" onSubmit={(e) => e.preventDefault()}>
        <h3 class="calc-form-title">ROAS Calculator</h3>
        <p class="calc-form-desc">
          Calculate your Return on Ad Spend and see if your campaigns are profitable.
        </p>
        <Field
          label="Monthly ad spend ($)"
          hint="Total advertising budget across all channels"
          value={spend}
          step={100}
          onInput={setSpend}
        />
        <Field
          label="Revenue generated from ads ($)"
          hint="Total revenue attributed to your ad campaigns"
          value={revenue}
          step={500}
          onInput={setRevenue}
        />
        <Field
          label="Profit margin (%)"
          hint="Gross profit margin on products or services sold"
          value={margin}
          step={1}
          onInput={setMargin}
        />
        <Field
          label="Total orders / conversions"
          hint="Number of orders or conversions from these ads"
          value={orders}
          step={1}
          onInput={setOrders}
        />
      </form>

      <div class="calc-results">
        <h3 class="calc-results-title">Your ad performance</h3>
        <Result label="ROAS (return on ad spend)" value={`${results.roas.toFixed(1)}x`} emphasis />
        <Result label="Gross profit from ads" value={money(Math.round(results.grossProfit))} emphasis />
        <Result label="Net profit (after ad spend)" value={money(Math.round(results.netProfit))} />
        <Result label="Cost per acquisition" value={money(results.cpa)} />
        <Result label="Revenue per order" value={money(results.rpo)} />
        <Result label="Profit per order" value={money(results.ppo)} />
        <a href="/contact" class="btn-green calc-cta">Improve your ROAS</a>
      </div>
    </div>
  );
}
