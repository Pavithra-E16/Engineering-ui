import { useSearchParams } from 'react-router-dom';
import { Tabs } from './ui';
/** Tab container that keeps the selected tab in the URL (?tab=). */
export function UrlTabs({ tabs, children }) {
  const [params, setParams] = useSearchParams();
  const visible = tabs.filter((t) => !t.hidden);
  const cur = visible.find((t) => t.id === params.get('tab'))?.id ?? visible[0]?.id;
  return (
    <>
      <Tabs
        tabs={visible}
        value={cur}
        onChange={(t) => {
          const p = new URLSearchParams(params);
          p.set('tab', t);
          p.delete('q');
          setParams(p, { replace: true });
        }}
      />
      <div key={cur}>{children(cur)}</div>
    </>
  );
}
