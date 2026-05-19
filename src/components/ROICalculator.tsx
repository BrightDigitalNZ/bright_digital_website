/** @jsxImportSource preact */
import { useMemo, useRef, useState } from 'preact/hooks';

function trackFirstUse(ref: { current: boolean }, name: string) {
  if (ref.current) return;
  ref.current = true;
  const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer ?? [];
  (window as unknown as { dataLayer: unknown[] }).dataLayer = dl;
  dl.push({ event: 'calculator_use', calculator_name: name });
}

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

export default function ROICalculator() {
  const [spend, setSpend] = useState(5000);
  const [cpc, setCpc] = useState(2.5);
  const [cvr, setCvr] = useState(3);
  const [closeRate, setCloseRate] = useState(20);
  const [acv, setAcv] = useState(1500);
  const interacted = useRef(false);
  const track = (setter: (n: number) => void) => (n: number) => {
    trackFirstUse(interacted, 'roi');
    setter(n);
  };

  const results = useMemo(() => {
    const clicks = cpc > 0 ? Math.round(spend / cpc) : 0;
    const leads = Math.round((clicks * cvr) / 100);
    const customers = Math.round((leads * closeRate) / 100);
    const revenue = customers * acv;
    const roi = spend > 0 ? Math.round(((revenue - spend) / spend) * 100) : 0;
    const cpl = leads > 0 ? Math.round(spend / leads) : 0;
    const cpa = customers > 0 ? Math.round(spend / customers) : 0;
    return { clicks, leads, customers, revenue, roi, cpl, cpa };
  }, [spend, cpc, cvr, closeRate, acv]);

  return (
    <div class="calc">
      <form class="calc-form" onSubmit={(e) => e.preventDefault()}>
        <h3 class="calc-form-title">Marketing ROI Calculator</h3>
        <p class="calc-form-desc">
          Find out the return on investment from your marketing campaigns.
        </p>
        <Field
          label="Monthly ad spend ($)"
          hint="Your total monthly marketing budget"
          value={spend}
          step={100}
          onInput={track(setSpend)}
        />
        <Field
          label="Average cost per click ($)"
          hint="CPC from your Google Ads or paid campaigns"
          value={cpc}
          step={0.1}
          onInput={track(setCpc)}
        />
        <Field
          label="Website conversion rate (%)"
          hint="Percentage of visitors that become leads or customers"
          value={cvr}
          step={0.5}
          onInput={track(setCvr)}
        />
        <Field
          label="Lead close rate (%)"
          hint="Percentage of leads that convert to paying customers"
          value={closeRate}
          step={1}
          onInput={track(setCloseRate)}
        />
        <Field
          label="Average customer value ($)"
          hint="Average revenue per customer"
          value={acv}
          step={50}
          onInput={track(setAcv)}
        />
      </form>

      <div class="calc-results">
        <h3 class="calc-results-title">Your projected results</h3>
        <Result label="Monthly clicks" value={fmt(results.clicks)} />
        <Result label="Monthly leads" value={fmt(results.leads)} />
        <Result label="Monthly customers" value={fmt(results.customers)} />
        <Result label="Monthly revenue" value={money(results.revenue)} emphasis />
        <Result label="Return on investment" value={`${results.roi}%`} emphasis />
        <Result label="Cost per lead" value={money(results.cpl)} />
        <Result label="Cost per acquisition" value={money(results.cpa)} />
        <a href="/contact" class="btn-green calc-cta">Want these results? Let us talk</a>
      </div>
    </div>
  );
}
