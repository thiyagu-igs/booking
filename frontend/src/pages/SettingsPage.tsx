import { useState } from 'react'
import { Tab } from '@headlessui/react'
import { clsx } from 'clsx'
import { Card } from '../components/Card'
import BusinessHoursSettings from '../components/settings/BusinessHoursSettings'
import ServicesSettings from '../components/settings/ServicesSettings'
import StaffSettings from '../components/settings/StaffSettings'
import EmailTemplatesSettings from '../components/settings/EmailTemplatesSettings'
import { QRCodeGenerator } from '../components/QRCodeGenerator'

const tabs = [
  { name: 'Business Hours', component: BusinessHoursSettings },
  { name: 'Services', component: ServicesSettings },
  { name: 'Staff', component: StaffSettings },
  { name: 'Email Templates', component: EmailTemplatesSettings },
  { name: 'QR Code & Links', component: QRCodeGenerator },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Configure your business settings and preferences
        </p>
      </div>

      <Card padding="none">
        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-t-lg bg-gray-100 dark:bg-gray-700 p-1">
            {tabs.map((tab) => (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  clsx(
                    'w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    selected
                      ? 'bg-white dark:bg-gray-800 text-primary-700 dark:text-primary-400 shadow'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-white/[0.12] hover:text-gray-800 dark:hover:text-gray-200'
                  )
                }
              >
                {tab.name}
              </Tab>
            ))}
          </Tab.List>
          <Tab.Panels className="p-6">
            {tabs.map((tab, idx) => (
              <Tab.Panel
                key={idx}
                className="focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-lg"
              >
                <tab.component />
              </Tab.Panel>
            ))}
          </Tab.Panels>
        </Tab.Group>
      </Card>
    </div>
  )
}