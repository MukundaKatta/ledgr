'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';

interface Props {
  org: any;
  orgId: string;
}

export function OrganizationSettings({ org, orgId }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(org?.name || '');
  const [legalName, setLegalName] = useState(org?.legal_name || '');
  const [ein, setEin] = useState(org?.ein || '');
  const [businessType, setBusinessType] = useState(org?.business_type || 'sole_proprietorship');
  const [email, setEmail] = useState(org?.email || '');
  const [phone, setPhone] = useState(org?.phone || '');
  const [address1, setAddress1] = useState(org?.address_line1 || '');
  const [city, setCity] = useState(org?.city || '');
  const [state, setState] = useState(org?.state || '');
  const [zip, setZip] = useState(org?.zip || '');

  async function handleSave() {
    setLoading(true);
    await supabase
      .from('organizations')
      .update({
        name,
        legal_name: legalName || null,
        ein: ein || null,
        business_type: businessType,
        email: email || null,
        phone: phone || null,
        address_line1: address1 || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
      })
      .eq('id', orgId);

    setLoading(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Information</CardTitle>
        <CardDescription>Your business details for invoices and tax filings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name</label>
            <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="If different from business name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">EIN</label>
            <Input value={ein} onChange={(e) => setEin(e.target.value)} placeholder="XX-XXXXXXX" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
            <Select value={businessType} onValueChange={setBusinessType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
                <SelectItem value="llc">LLC</SelectItem>
                <SelectItem value="llc_s_corp">LLC (S-Corp election)</SelectItem>
                <SelectItem value="llc_c_corp">LLC (C-Corp election)</SelectItem>
                <SelectItem value="s_corp">S Corporation</SelectItem>
                <SelectItem value="c_corp">C Corporation</SelectItem>
                <SelectItem value="partnership">Partnership</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <Input value={address1} onChange={(e) => setAddress1(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
