import { useState, useEffect } from 'react'
import Button from '../Button'
import LoadingSpinner from '../LoadingSpinner'
import { api } from '../../services/api'

interface EmailTemplate {
  type: 'notification' | 'confirmation' | 'reminder'
  subject: string
  htmlContent: string
  textContent: string
}

const templateTypes = [
  {
    key: 'notification' as const,
    name: 'Slot Available Notification',
    description: 'Email sent when a slot becomes available for a waitlisted customer'
  },
  {
    key: 'confirmation' as const,
    name: 'Booking Confirmation',
    description: 'Email sent after a customer confirms their booking'
  },
  {
    key: 'reminder' as const,
    name: 'Appointment Reminder',
    description: 'Email sent as a reminder before the appointment'
  }
]

const defaultTemplates: Record<string, EmailTemplate> = {
  notification: {
    type: 'notification',
    subject: 'Slot Available - {{serviceName}} with {{staffName}}',
    htmlContent: `
<h2>Great news! A slot is now available</h2>
<p>Hi {{customerName}},</p>
<p>We have a <strong>{{serviceName}}</strong> appointment available with {{staffName}} on {{date}} at {{time}}.</p>
<p>This slot is being held for you for the next 10 minutes.</p>
<div style="margin: 20px 0;">
  <a href="{{confirmLink}}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Confirm Booking</a>
  <a href="{{declineLink}}" style="background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-left: 10px;">Decline</a>
</div>
<p>If you don't respond within 10 minutes, this slot will be offered to the next person on the waitlist.</p>
<p>Thank you!</p>
    `.trim(),
    textContent: `
Hi {{customerName}},

Great news! We have a {{serviceName}} appointment available with {{staffName}} on {{date}} at {{time}}.

This slot is being held for you for the next 10 minutes.

To confirm: {{confirmLink}}
To decline: {{declineLink}}

If you don't respond within 10 minutes, this slot will be offered to the next person on the waitlist.

Thank you!
    `.trim()
  },
  confirmation: {
    type: 'confirmation',
    subject: 'Booking Confirmed - {{serviceName}} on {{date}}',
    htmlContent: `
<h2>Your booking is confirmed!</h2>
<p>Hi {{customerName}},</p>
<p>Your <strong>{{serviceName}}</strong> appointment with {{staffName}} is confirmed for:</p>
<div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0;">
  <p><strong>Date:</strong> {{date}}</p>
  <p><strong>Time:</strong> {{time}}</p>
  <p><strong>Service:</strong> {{serviceName}}</p>
  <p><strong>Staff:</strong> {{staffName}}</p>
  <p><strong>Duration:</strong> {{duration}} minutes</p>
  <p><strong>Price:</strong> ${{price}}</p>
</div>
<p>We look forward to seeing you!</p>
    `.trim(),
    textContent: `
Hi {{customerName}},

Your {{serviceName}} appointment with {{staffName}} is confirmed for:

Date: {{date}}
Time: {{time}}
Service: {{serviceName}}
Staff: {{staffName}}
Duration: {{duration}} minutes
Price: ${{price}}

We look forward to seeing you!
    `.trim()
  },
  reminder: {
    type: 'reminder',
    subject: 'Reminder - {{serviceName}} appointment tomorrow',
    htmlContent: `
<h2>Appointment Reminder</h2>
<p>Hi {{customerName}},</p>
<p>This is a friendly reminder about your upcoming appointment:</p>
<div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0;">
  <p><strong>Service:</strong> {{serviceName}}</p>
  <p><strong>Staff:</strong> {{staffName}}</p>
  <p><strong>Date:</strong> {{date}}</p>
  <p><strong>Time:</strong> {{time}}</p>
</div>
<p>Please arrive 5 minutes early. If you need to reschedule or cancel, please contact us as soon as possible.</p>
<p>We look forward to seeing you!</p>
    `.trim(),
    textContent: `
Hi {{customerName}},

This is a friendly reminder about your upcoming appointment:

Service: {{serviceName}}
Staff: {{staffName}}
Date: {{date}}
Time: {{time}}

Please arrive 5 minutes early. If you need to reschedule or cancel, please contact us as soon as possible.

We look forward to seeing you!
    `.trim()
  }
}

export default function EmailTemplatesSettings() {
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<string>('notification')

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const response = await api.get('/settings/email-templates')
      setTemplates({ ...defaultTemplates, ...response.data })
    } catch (error) {
      console.error('Failed to load email templates:', error)
      setTemplates(defaultTemplates)
    } finally {
      setLoading(false)
    }
  }

  const updateTemplate = (type: string, field: string, value: string) => {
    setTemplates(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }))
  }

  const saveTemplates = async () => {
    setSaving(true)
    try {
      await api.put('/settings/email-templates', templates)
    } catch (error) {
      console.error('Failed to save email templates:', error)
    } finally {
      setSaving(false)
    }
  }

  const resetTemplate = (type: string) => {
    if (!confirm('Are you sure you want to reset this template to default?')) return
    
    setTemplates(prev => ({
      ...prev,
      [type]: defaultTemplates[type]
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const currentTemplate = templates[activeTemplate]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Email Templates</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Customize the email templates sent to your customers
          </p>
        </div>
        <Button onClick={saveTemplates} loading={saving}>
          Save All Templates
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Template Selection */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Template Type</h4>
          {templateTypes.map((template) => (
            <button
              key={template.key}
              onClick={() => setActiveTemplate(template.key)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                activeTemplate === template.key
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="font-medium text-sm">{template.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {template.description}
              </div>
            </button>
          ))}
        </div>

        {/* Template Editor */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {templateTypes.find(t => t.key === activeTemplate)?.name}
            </h4>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => resetTemplate(activeTemplate)}
            >
              Reset to Default
            </Button>
          </div>

          {currentTemplate && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={currentTemplate.subject}
                  onChange={(e) => updateTemplate(activeTemplate, 'subject', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  HTML Content
                </label>
                <textarea
                  className="input-field"
                  rows={12}
                  value={currentTemplate.htmlContent}
                  onChange={(e) => updateTemplate(activeTemplate, 'htmlContent', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Plain Text Content
                </label>
                <textarea
                  className="input-field"
                  rows={8}
                  value={currentTemplate.textContent}
                  onChange={(e) => updateTemplate(activeTemplate, 'textContent', e.target.value)}
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <h5 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                  Available Variables
                </h5>
                <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <div><code>{'{{customerName}}'}</code> - Customer's name</div>
                  <div><code>{'{{serviceName}}'}</code> - Service name</div>
                  <div><code>{'{{staffName}}'}</code> - Staff member name</div>
                  <div><code>{'{{date}}'}</code> - Appointment date</div>
                  <div><code>{'{{time}}'}</code> - Appointment time</div>
                  <div><code>{'{{duration}}'}</code> - Service duration</div>
                  <div><code>{'{{price}}'}</code> - Service price</div>
                  <div><code>{'{{confirmLink}}'}</code> - Confirmation link (notification only)</div>
                  <div><code>{'{{declineLink}}'}</code> - Decline link (notification only)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}