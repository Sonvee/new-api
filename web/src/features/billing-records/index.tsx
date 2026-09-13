/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { BillingRecordsTable } from './components/billing-records-table'

export function BillingRecords() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'consumption' | 'ledger'>('consumption')

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Billing Records')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex h-full min-h-0 flex-col gap-4'>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'consumption' | 'ledger')}>
            <TabsList>
              <TabsTrigger value='consumption'>{t('Consumption records')}</TabsTrigger>
              <TabsTrigger value='ledger'>{t('Balance ledger')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className='min-h-0 flex-1'>
            <BillingRecordsTable key={activeTab} kind={activeTab} />
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
