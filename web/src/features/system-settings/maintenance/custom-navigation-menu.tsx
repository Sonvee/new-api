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
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import { SettingsControlGroup } from '../components/settings-form-layout'
import type { HeaderNavFormValues } from './header-navigation-schema'

type CustomNavigationMenuProps = {
  form: UseFormReturn<HeaderNavFormValues>
}

export function CustomNavigationMenu(props: CustomNavigationMenuProps) {
  const { t } = useTranslation()
  const customLinks = useFieldArray({
    control: props.form.control,
    name: 'customLinks',
  })

  return (
    <SettingsControlGroup>
      <div className='flex flex-col justify-between gap-3 sm:flex-row sm:items-center'>
        <div className='flex min-w-0 flex-col gap-1'>
          <h4 className='text-sm font-medium'>{t('Custom navigation menu')}</h4>
          <p className='text-muted-foreground text-sm'>
            {t('Custom menu items appear after the built-in navigation links.')}
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          onClick={() => customLinks.append({ name: '', url: '' })}
        >
          <HugeiconsIcon
            icon={Add01Icon}
            strokeWidth={2}
            data-icon='inline-start'
            aria-hidden='true'
          />
          {t('Add menu item')}
        </Button>
      </div>

      {customLinks.fields.length === 0 ? (
        <Empty className='border py-6'>
          <EmptyHeader>
            <EmptyTitle>{t('No custom menu items yet.')}</EmptyTitle>
            <EmptyDescription>
              {t('Add a menu item to show it in the top navigation.')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className='flex flex-col gap-3'>
          {customLinks.fields.map((item, index) => (
            <div
              key={item.id}
              className='bg-background grid min-w-0 gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-start'
            >
              <FormField
                control={props.form.control}
                name={`customLinks.${index}.name` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Menu name')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('Menu name')}
                        autoComplete='off'
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={props.form.control}
                name={`customLinks.${index}.url` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Menu address')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('/path or https://example.com')}
                        autoComplete='url'
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className='flex shrink-0 items-center gap-1 md:pt-6'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  disabled={index === 0}
                  aria-label={t('Move menu item {{position}} up', {
                    position: index + 1,
                  })}
                  title={t('Move up')}
                  onClick={() => customLinks.move(index, index - 1)}
                >
                  <HugeiconsIcon
                    icon={ArrowUp01Icon}
                    strokeWidth={2}
                    aria-hidden='true'
                  />
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  disabled={index === customLinks.fields.length - 1}
                  aria-label={t('Move menu item {{position}} down', {
                    position: index + 1,
                  })}
                  title={t('Move down')}
                  onClick={() => customLinks.move(index, index + 1)}
                >
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    strokeWidth={2}
                    aria-hidden='true'
                  />
                </Button>
                <Button
                  type='button'
                  variant='destructive'
                  size='icon'
                  aria-label={t('Delete menu item {{position}}', {
                    position: index + 1,
                  })}
                  title={t('Delete')}
                  onClick={() => customLinks.remove(index)}
                >
                  <HugeiconsIcon
                    icon={Delete02Icon}
                    strokeWidth={2}
                    aria-hidden='true'
                  />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsControlGroup>
  )
}
