import { Package, IndianRupee, Wrench, Archive } from 'lucide-react';
import { useData } from '../../data/store';
import { EntityPage } from '../../components/EntityPage';
import { PageHeader, StatCard } from '../../components/ui';
import { fmtMoney, sum } from '../../lib/utils';
export default function Assets() {
  const { db } = useData();
  const a = db.assets.filter((x) => x.active !== false);
  return (
    <>
      <PageHeader title="Asset Management" subtitle="Asset register: categories, locations, purchase details, departments and status" />
      <div className="grid cols-4 stats">
        <StatCard label="Assets" value={a.length} icon={Package} />
        <StatCard label="Book value (cost)" value={fmtMoney(sum(a.map((x) => x.cost)))} icon={IndianRupee} tone="blue" />
        <StatCard label="Under repair" value={a.filter((x) => x.status === 'Under Repair').length} icon={Wrench} tone="amber" />
        <StatCard label="In store" value={a.filter((x) => x.status === 'In Store').length} icon={Archive} tone="violet" />
      </div>
      <EntityPage
        config={{
          collection: 'assets',
          title: 'Asset register',
          singular: 'Asset',
          module: 'assets',
          initialSort: { key: 'assetId', dir: 'asc' },
          fields: [
            { key: 'assetId', label: 'Asset ID', required: true, unique: true },
            { key: 'name', label: 'Name', required: true },
            {
              key: 'category',
              label: 'Category',
              type: 'select',
              options: ['IT Equipment', 'AV Equipment', 'Lab Equipment', 'Survey Equipment', 'Electrical', 'Furniture', 'Vehicle', 'Other'],
              required: true,
              filter: true,
            },
            { key: 'location', label: 'Location', required: true },
            { key: 'departmentId', label: 'Department', type: 'ref', ref: 'departments', filter: true },
            { key: 'purchaseDate', label: 'Purchase date', type: 'date', required: true },
            { key: 'cost', label: 'Cost', type: 'money', min: 0, required: true },
            { key: 'vendor', label: 'Vendor', required: true, table: false },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: ['In Use', 'In Store', 'Under Repair', 'Disposed'],
              required: true,
              filter: true,
            },
          ],
        }}
      />
    </>
  );
}
