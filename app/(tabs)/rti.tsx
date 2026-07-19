import { ScrollView, View, Text, Pressable, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  FileText, ChevronRight, ChevronLeft, CheckCircle, Copy,
  ArrowRight, Sparkles, User, Building2, HelpCircle, Scale, Stamp,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useLang } from '../../lib/langContext';

type Step = 1 | 2 | 3 | 4;

interface RTIForm {
  applicantName: string;
  fatherName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  authorityType: string;
  authorityName: string;
  department: string;
  pioConcern: string;
  naturalQuery: string;
  infoCategory: string;
  timePeriodFrom: string;
  timePeriodTo: string;
  specificDocuments: string;
  urgencyReason: string;
  isBPL: boolean;
  bplCardNumber: string;
  paymentMode: string;
}

const AUTHORITY_TYPES = [
  'rti_auth_central' as const,
  'rti_auth_state' as const,
  'rti_auth_municipal' as const,
  'rti_auth_collectorate' as const,
  'rti_auth_psu' as const,
  'rti_auth_police' as const,
  'rti_auth_revenue' as const,
  'rti_auth_urban' as const,
  'rti_auth_edu' as const,
  'rti_auth_health' as const,
];

const INFO_CATEGORIES = [
  { value: 'documents', labelKey: 'rti_cat_documents' as const },
  { value: 'status', labelKey: 'rti_cat_status' as const },
  { value: 'expenditure', labelKey: 'rti_cat_expenditure' as const },
  { value: 'appointments', labelKey: 'rti_cat_appointments' as const },
  { value: 'complaints', labelKey: 'rti_cat_complaints' as const },
  { value: 'policy', labelKey: 'rti_cat_policy' as const },
  { value: 'tenders', labelKey: 'rti_cat_tenders' as const },
];

const PAYMENT_MODES = ['Indian Postal Order (IPO)', 'DD / Banker Cheque', 'Court Fee Stamp', 'Treasury Challan', 'Online Payment'];

const STEP_LABELS = ['Applicant', 'Public', 'Information', 'Review'];

function generateRTI(form: RTIForm): string {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const refNo = `RTI/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 90000) + 10000)}`;

  const queryLines: string[] = [];
  let idx = 1;
  queryLines.push(`${idx++}. All information, records, files, noting, correspondence and documents related to: "${form.naturalQuery}".`);
  queryLines.push(`${idx++}. Names and designations of public servants associated with the matter.`);
  queryLines.push(`${idx++}. Action taken/proposed on the subject matter.`);

  return `To,
The Public Information Officer (PIO),
${form.authorityName}${form.department ? ',' + form.department : ''},
${form.pioConcern || form.city}.

Date: ${today}
Reference: ${refNo}

Subject: Application under Section 6(1) of the Right to Information Act, 2005

Respected Sir/Madam,

I, ${form.applicantName}, Son/Daughter/Wife of ${form.fatherName || '____________________'}, residing at ${form.address}, ${form.city} – ${form.pincode || '______'}, ${form.state}, do hereby request you to furnish the following information under the Right to Information Act, 2005.

INFORMATION SOUGHT:
${queryLines.join('\n')}

${form.isBPL
      ? `I am a Below Poverty Line (BPL) citizen. My BPL Card Number is ${form.bplCardNumber || '____________________'}. Hence, I am exempted from paying the application fee as per Section 7(5) of the RTI Act, 2005.`
      : `I am enclosing the prescribed application fee of Rs. 10/- by way of ${form.paymentMode}.`}

I request that the information be provided within 30 days from the date of receipt of this application as required under Section 7(1) of the RTI Act, 2005.

Thanking you,

Yours faithfully,

_______________________
${form.applicantName}
${form.address},
${form.city} – ${form.pincode || '______'}, ${form.state}
Phone: ${form.phone || '____________________'}

Date: ${today}
Place: ${form.city}`;
}

export default function RTIScreen() {
  const { T } = useLang();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<RTIForm>({
    applicantName: '', fatherName: '', address: '', city: '', state: '', pincode: '', phone: '', email: '',
    authorityType: '', authorityName: '', department: '', pioConcern: '',
    naturalQuery: '', infoCategory: 'documents', timePeriodFrom: '', timePeriodTo: '', specificDocuments: '', urgencyReason: '',
    isBPL: false, bplCardNumber: '', paymentMode: 'Indian Postal Order (IPO)',
  });
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  function update(key: keyof RTIForm, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function canProceed() {
    if (step === 1) return form.applicantName.trim() && form.address.trim() && form.city.trim() && form.state.trim();
    if (step === 2) return form.authorityName.trim() && form.authorityType;
    if (step === 3) return form.naturalQuery.trim().length >= 15;
    return true;
  }

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => {
      setGeneratedText(generateRTI(form));
      setGenerating(false);
    }, 900);
  }

  async function handleCopy() {
    if (generatedText) {
      await Clipboard.setStringAsync(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        {/* Section Header */}
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <Scale size={16} color="#ea580c" />
            <Text style={styles.badgeText}>{T.rti_badge || 'CITIZEN LEGAL TOOLS'}</Text>
          </View>
          <Text style={styles.title}>{T.rti_title || 'RTI Application Drafter'}</Text>
          <Text style={styles.subtitle}>
            {T.rti_subtitle || 'Answer a few simple questions. We instantly generate a legally formatted Right to Information application ready to file under the RTI Act, 2005.'}
          </Text>
        </View>

        {/* Progress Tracker */}
        <View style={styles.stepContainer}>
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as Step;
            const active = step === n;
            const done = step > n;
            return (
              <View key={n} style={styles.stepItem}>
                <View style={[
                  styles.stepPill,
                  active ? styles.stepPillActive : styles.stepPillInactive
                ]}>
                  <Text style={[
                    styles.stepPillText,
                    active ? styles.stepPillTextActive : styles.stepPillTextInactive
                  ]}>
                    {n} {label}
                  </Text>
                </View>
                {i < STEP_LABELS.length - 1 && (
                  <View style={styles.stepLine} />
                )}
              </View>
            );
          })}
        </View>

        {/* White Form Card */}
        <View style={styles.card}>
          {/* Step 1: Applicant Details */}
          {step === 1 && (
            <View>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBox}>
                  <User size={16} color="#ea580c" />
                </View>
                <Text style={styles.cardTitle}>{T.rti_your_details || 'Your'}</Text>
              </View>

              <View style={styles.formGap}>
                <View>
                  <Text style={styles.inputLabel}>{T.rti_full_name || 'Full Name'} *</Text>
                  <TextInput
                    value={form.applicantName}
                    onChangeText={v => update('applicantName', v)}
                    placeholder={T.rti_name_placeholder || 'As per identity proof'}
                    style={styles.input}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View>
                  <Text style={styles.inputLabel}>{T.rti_father_name || "Father's / Husband's Name"}</Text>
                  <TextInput
                    value={form.fatherName}
                    onChangeText={v => update('fatherName', v)}
                    placeholder={T.rti_father_placeholder || 'S/o or W/o'}
                    style={styles.input}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View>
                  <Text style={styles.inputLabel}>{T.rti_address || 'Complete Address'} *</Text>
                  <TextInput
                    value={form.address}
                    onChangeText={v => update('address', v)}
                    placeholder={T.rti_address_placeholder || 'House No., Street, Locality'}
                    style={[styles.input, styles.textArea]}
                    multiline
                    numberOfLines={2}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.inputLabel}>{T.rti_city || 'City / District'} *</Text>
                    <TextInput
                      value={form.city}
                      onChangeText={v => update('city', v)}
                      placeholder={T.rti_city_placeholder || 'Delhi'}
                      style={styles.input}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.inputLabel}>{T.rti_state || 'State'} *</Text>
                    <TextInput
                      value={form.state}
                      onChangeText={v => update('state', v)}
                      placeholder="e.g. Delhi"
                      style={styles.input}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.inputLabel}>{T.rti_pincode || 'PIN Code'}</Text>
                    <TextInput
                      value={form.pincode}
                      onChangeText={v => update('pincode', v)}
                      placeholder="110001"
                      keyboardType="numeric"
                      style={styles.input}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.inputLabel}>{T.rti_mobile || 'Mobile Number'}</Text>
                    <TextInput
                      value={form.phone}
                      onChangeText={v => update('phone', v)}
                      placeholder={T.rti_mobile_placeholder || '+91 98765 43210'}
                      keyboardType="phone-pad"
                      style={styles.input}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Step 2: Public Authority */}
          {step === 2 && (
            <View>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBox}>
                  <Building2 size={16} color="#ea580c" />
                </View>
                <Text style={styles.cardTitle}>{T.rti_authority_title || 'Public Authority'}</Text>
              </View>

              <View style={styles.formGap}>
                <View>
                  <Text style={styles.inputLabel}>{T.rti_authority_type || 'Authority Type'} *</Text>
                  <View style={styles.chipRow}>
                    {AUTHORITY_TYPES.map(a => (
                      <Pressable
                        key={a}
                        onPress={() => update('authorityType', a)}
                        style={[
                          styles.chip,
                          form.authorityType === a ? styles.chipActive : styles.chipInactive
                        ]}
                      >
                        <Text style={[
                          styles.chipText,
                          form.authorityType === a ? styles.chipTextActive : styles.chipTextInactive
                        ]}>
                          {T[a] || a}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View>
                  <Text style={styles.inputLabel}>{T.rti_authority_name || 'Public Authority Name'} *</Text>
                  <TextInput
                    value={form.authorityName}
                    onChangeText={v => update('authorityName', v)}
                    placeholder={T.rti_authority_placeholder || 'e.g. Municipal Corporation of Delhi'}
                    style={styles.input}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View>
                  <Text style={styles.inputLabel}>{T.rti_dept_branch || 'Department / Branch'}</Text>
                  <TextInput
                    value={form.department}
                    onChangeText={v => update('department', v)}
                    placeholder={T.rti_dept_placeholder || 'e.g. Sanitation Department'}
                    style={styles.input}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Step 3: Information Required */}
          {step === 3 && (
            <View>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBox}>
                  <HelpCircle size={16} color="#ea580c" />
                </View>
                <Text style={styles.cardTitle}>{T.rti_query_title || 'Information Sought'}</Text>
              </View>

              <View style={styles.formGap}>
                <View>
                  <Text style={styles.inputLabel}>{T.rti_query_label || 'Specify Information Required'} *</Text>
                  <TextInput
                    value={form.naturalQuery}
                    onChangeText={v => update('naturalQuery', v)}
                    placeholder={T.rti_query_placeholder || 'e.g. Status of repair work of street lights in sector 135...'}
                    multiline
                    numberOfLines={4}
                    style={[styles.input, styles.textArea, { minHeight: 90 }]}
                    placeholderTextColor="#94a3b8"
                  />
                  <Text style={styles.helpText}>{form.naturalQuery.length} characters (min 15)</Text>
                </View>

                <View>
                  <Text style={styles.inputLabel}>{T.rti_category || 'Category of Information'}</Text>
                  <View style={styles.chipRow}>
                    {INFO_CATEGORIES.map(c => (
                      <Pressable
                        key={c.value}
                        onPress={() => update('infoCategory', c.value)}
                        style={[
                          styles.chip,
                          form.infoCategory === c.value ? styles.chipActive : styles.chipInactive
                        ]}
                      >
                        <Text style={[
                          styles.chipText,
                          form.infoCategory === c.value ? styles.chipTextActive : styles.chipTextInactive
                        ]}>
                          {T[c.labelKey] || c.value}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.checkboxCard}>
                  <Pressable
                    onPress={() => update('isBPL', !form.isBPL)}
                    style={styles.checkboxRow}
                  >
                    <View style={[
                      styles.checkbox,
                      form.isBPL ? styles.checkboxChecked : styles.checkboxUnchecked
                    ]}>
                      {form.isBPL && <CheckCircle size={12} color="white" />}
                    </View>
                    <Text style={styles.checkboxLabel}>{T.rti_bpl_label || 'Below Poverty Line (BPL) Citizen'}</Text>
                  </Pressable>

                  {form.isBPL && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={styles.inputLabel}>{T.rti_bpl_card || 'BPL Card Number'} *</Text>
                      <TextInput
                        value={form.bplCardNumber}
                        onChangeText={v => update('bplCardNumber', v)}
                        placeholder="Enter BPL card number"
                        style={styles.input}
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Step 4: Review & Generate */}
          {step === 4 && (
            <View>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBox}>
                  <Stamp size={16} color="#ea580c" />
                </View>
                <Text style={styles.cardTitle}>{T.rti_review_title || 'Review & Generate'}</Text>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{T.rti_applicant || 'Applicant'}</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>{form.applicantName || '—'}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{T.rti_authority || 'Public Authority'}</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>{form.authorityName || '—'}</Text>
                </View>
              </View>

              {!generatedText ? (
                <Pressable
                  onPress={handleGenerate}
                  disabled={generating}
                  style={[styles.generateBtn, generating ? styles.generateBtnDisabled : styles.generateBtnActive]}
                >
                  {generating ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Sparkles size={18} color="white" />
                  )}
                  <Text style={styles.generateBtnText}>
                    {generating ? (T.rti_generating || 'Generating...') : (T.rti_generate_btn || 'Generate RTI Application')}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.generatedContainer}>
                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={handleCopy}
                      style={[styles.actionBtn, copied ? styles.actionBtnCopied : styles.actionBtnNormal]}
                    >
                      {copied ? <CheckCircle size={14} color="#16a34a" /> : <Copy size={14} color="#6b7280" />}
                      <Text style={[styles.actionBtnText, copied ? { color: '#16a34a' } : { color: '#475569' }]}>
                        {copied ? (T.rti_copied || 'Copied') : (T.rti_copy || 'Copy Text')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setGeneratedText(null)}
                      style={[styles.actionBtn, styles.actionBtnRegen]}
                    >
                      <Sparkles size={14} color="#ea580c" />
                      <Text style={[styles.actionBtnText, { color: '#ea580c' }]}>
                        {T.rti_regenerate || 'Regenerate'}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.readyCard}>
                    <Text style={styles.readyTitle}>{T.rti_ready || 'Application Draft'}</Text>
                    <Text style={styles.readyText} selectable>{generatedText}</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Navigation Action Footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => setStep(s => Math.max(1, s - 1) as Step)}
            disabled={step === 1}
            style={[styles.navBtn, step === 1 ? styles.navBtnDisabled : styles.navBtnActive]}
          >
            <ChevronLeft size={16} color={step === 1 ? '#cbd5e1' : '#475569'} />
            <Text style={[styles.navBtnText, step === 1 ? { color: '#cbd5e1' } : { color: '#475569' }]}>
              {T.rti_back || 'Back'}
            </Text>
          </Pressable>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {[1, 2, 3, 4].map(s => (
              <View
                key={s}
                style={[
                  styles.dot,
                  s === step ? styles.dotActive : s < step ? styles.dotDone : styles.dotInactive
                ]}
              />
            ))}
          </View>

          {step < 4 ? (
            <Pressable
              onPress={() => setStep(s => Math.min(4, s + 1) as Step)}
              disabled={!canProceed()}
              style={[styles.nextBtn, !canProceed() ? styles.nextBtnDisabled : styles.nextBtnActive]}
            >
              <Text style={[styles.nextBtnText, !canProceed() ? { color: '#94a3b8' } : { color: 'white' }]}>
                {T.rti_next || 'Next'}
              </Text>
              <ChevronRight size={16} color={!canProceed() ? '#94a3b8' : 'white'} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/(tabs)/submit')}
              style={[styles.nextBtn, styles.nextBtnActive, { backgroundColor: '#1e293b' }]}
            >
              <Text style={[styles.nextBtnText, { color: 'white' }]}>
                {T.rti_file_complaint || 'File Complaint'}
              </Text>
              <ArrowRight size={15} color="white" />
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 16,
    paddingTop: 12,
  },
  // Header
  header: {
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  // Step Tracker
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stepPillActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  stepPillInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  stepPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stepPillTextActive: {
    color: '#ffffff',
  },
  stepPillTextInactive: {
    color: '#64748b',
  },
  stepLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 4,
  },
  // Card Form
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  cardIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  formGap: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 72,
    textAlignVertical: 'top',
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  // Step 2 & 3 custom elements
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipActive: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
  },
  chipInactive: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ea580c',
  },
  chipTextInactive: {
    color: '#64748b',
  },
  helpText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  checkboxCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 12,
    padding: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  checkboxUnchecked: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  // Step 4 elements
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  generateBtnActive: {
    backgroundColor: '#ea580c',
  },
  generateBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  generateBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  generatedContainer: {
    gap: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnNormal: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  actionBtnCopied: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  actionBtnRegen: {
    backgroundColor: '#fff7ed',
    borderColor: '#ffedd5',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  readyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: 180,
  },
  readyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c',
    marginBottom: 8,
  },
  readyText: {
    fontSize: 11,
    color: '#334155',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  navBtnActive: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  navBtnDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#f1f5f9',
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    backgroundColor: '#ea580c',
  },
  dotDone: {
    width: 6,
    backgroundColor: '#fed7aa',
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#cbd5e1',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  nextBtnActive: {
    backgroundColor: '#ea580c',
  },
  nextBtnDisabled: {
    backgroundColor: '#e2e8f0',
  },
  nextBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
