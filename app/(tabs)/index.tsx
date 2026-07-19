import { ScrollView, View, Text, Pressable, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import {
  MapPin, Brain, GitBranch, Bell, BarChart2, Shield, Scale, Camera,
  ArrowRight, FileText, TrendingUp, Users, CheckCircle, AlertTriangle, Clock,
  Lightbulb, Truck, Droplet, Circle, Construction, Zap, Activity
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { getAllComplaints, type Neo4jComplaint } from '../../lib/neo4j';
import { useLang } from '../../lib/langContext';

const ISSUE_TYPE_CONFIG: Record<string, { icon: React.ReactNode, bg: string, color: string }> = {
  'Street Light': { icon: <Lightbulb size={16} color="#ca8a04" />, bg: '#fef9c3', color: '#ca8a04' },
  'Road Damage': { icon: <Construction size={16} color="#ea580c" />, bg: '#ffedd5', color: '#ea580c' },
  'Waste Management': { icon: <Truck size={16} color="#16a34a" />, bg: '#dcfce7', color: '#16a34a' },
  'Water Supply': { icon: <Droplet size={16} color="#2563eb" />, bg: '#dbeafe', color: '#2563eb' },
  'Sewage': { icon: <Droplet size={16} color="#4b5563" />, bg: '#f3f4f6', color: '#4b5563' },
  'Electricity Hazard': { icon: <Zap size={16} color="#ca8a04" />, bg: '#fef9c3', color: '#ca8a04' },
  'Sanitation': { icon: <Activity size={16} color="#0d9488" />, bg: '#ccfbf1', color: '#0d9488' },
  'Healthcare': { icon: <Activity size={16} color="#dc2626" />, bg: '#fee2e2', color: '#dc2626' },
  'default': { icon: <FileText size={16} color="#4b5563" />, bg: '#f3f4f6', color: '#4b5563' },
};

const URGENCY_STYLES = {
  LOW: { bg: '#dbeafe', text: '#1d4ed8' },
  MEDIUM: { bg: '#fef9c3', text: '#b45309' },
  HIGH: { bg: '#ffedd5', text: '#c2410c' },
  CRITICAL: { bg: '#fee2e2', text: '#b91c1c' },
};

const STATUS_COLORS = {
  PENDING: '#ca8a04',
  ASSIGNED: '#2563eb',
  IN_PROGRESS: '#4f46e5',
  RESOLVED: '#16a34a',
  ESCALATED: '#dc2626',
};

export default function HomeScreen() {
  const { T } = useLang();
  const [stats, setStats] = useState({ total: 0, resolved: 0, pending: 0, escalated: 0 });
  const [recentComplaints, setRecentComplaints] = useState<Neo4jComplaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getAllComplaints();
        if (data) {
          setRecentComplaints(data.slice(0, 6));
          setStats({
            total: data.length,
            resolved: data.filter(c => c.status === 'RESOLVED').length,
            pending: data.filter(c => c.status === 'PENDING').length,
            escalated: data.filter(c => c.status === 'ESCALATED').length,
          });
        }
      } catch { /* show zeros if Neo4j unreachable on first load */ }
      setLoading(false);
    }
    loadData();
  }, []);

  const features = [
    { icon: <Brain size={22} color="#8b5cf6" />, title: T.feat1_title, desc: T.feat1_desc, bg: '#f3e8ff' },
    { icon: <GitBranch size={22} color="#3b82f6" />, title: T.feat2_title, desc: T.feat2_desc, bg: '#dbeafe' },
    { icon: <MapPin size={22} color="#22c55e" />, title: T.feat3_title, desc: T.feat3_desc, bg: '#dcfce7' },
    { icon: <Bell size={22} color="#f97316" />, title: T.feat4_title, desc: T.feat4_desc, bg: '#ffedd5' },
    { icon: <BarChart2 size={22} color="#14b8a6" />, title: T.feat5_title, desc: T.feat5_desc, bg: '#ccfbf1' },
    { icon: <Shield size={22} color="#ef4444" />, title: T.feat6_title, desc: T.feat6_desc, bg: '#fee2e2' },
  ];

  const steps = [
    { step: '01', title: T.step1_title, desc: T.step1_desc, icon: <FileText size={20} color="#f97316" /> },
    { step: '02', title: T.step2_title, desc: T.step2_desc, icon: <Brain size={20} color="#f97316" /> },
    { step: '03', title: T.step3_title, desc: T.step3_desc, icon: <GitBranch size={20} color="#f97316" /> },
    { step: '04', title: T.step4_title, desc: T.step4_desc, icon: <TrendingUp size={20} color="#f97316" /> },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <Image
          source={require('../../assets/app-logo.jpg')}
          style={styles.heroLogo}
        />
        <Text style={styles.heroTitle}>
          {T.hero_title_1}{' '}
          <Text style={styles.heroTitleOrange}>{T.hero_title_2}</Text>{' '}
          <Text style={styles.heroTitleGreen}>{T.hero_title_3}</Text>
        </Text>

        <Text style={styles.heroSubtitle}>
          {T.hero_subtitle}
        </Text>

        <View style={styles.btnRow}>
          <Link href="/submit" asChild>
            <Pressable style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{T.hero_file_btn}</Text>
              <ArrowRight size={16} color="white" />
            </Pressable>
          </Link>
          <Link href="/track" asChild>
            <Pressable style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>{T.hero_track_btn}</Text>
            </Pressable>
          </Link>
        </View>

        {/* India flag strip */}
        <View style={styles.flagStrip}>
          <View style={styles.flagOrange} />
          <View style={styles.flagWhite} />
          <View style={styles.flagGreen} />
        </View>
        <Text style={styles.tagline}>{T.hero_tagline}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statsGrid}>
          {[
            { label: T.stat_total, value: stats.total, icon: <Users size={20} color="#fb923c" /> },
            { label: T.stat_resolved, value: stats.resolved, icon: <CheckCircle size={20} color="#4ade80" /> },
            { label: T.stat_pending, value: stats.pending, icon: <Clock size={20} color="#facc15" /> },
            { label: T.stat_escalated, value: stats.escalated, icon: <AlertTriangle size={20} color="#f87171" /> },
          ].map(({ label, value, icon }) => (
            <View key={label} style={styles.statCard}>
              <View style={styles.statIconBox}>
                {icon}
              </View>
              <View>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* How it works */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{T.how_title}</Text>
        <Text style={styles.sectionSubtitle}>{T.how_subtitle}</Text>

        <View style={styles.stepsContainer}>
          {steps.map(({ step, title, desc, icon }) => (
            <View key={step} style={styles.stepCard}>
              <View style={styles.stepIconBox}>
                {icon}
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepNumber}>{step}</Text>
                  <Text style={styles.stepTitle}>{title}</Text>
                </View>
                <Text style={styles.stepDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Features */}
      <View style={[styles.section, styles.sectionBg]}>
        <Text style={styles.sectionTitle}>{T.feat_title}</Text>
        <Text style={styles.sectionSubtitle}>{T.feat_subtitle}</Text>

        <View style={styles.featuresContainer}>
          {features.map(({ icon, title, desc, bg }) => (
            <View key={title} style={styles.featureCard}>
              <View style={[styles.featureIconBox, { backgroundColor: bg }]}>
                {icon}
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Recent Complaints */}
      {recentComplaints.length > 0 && (
        <View style={[styles.section, styles.sectionBg]}>
          <View style={styles.complaintHeaderRow}>
            <Text style={styles.complaintTitle}>{T.feed_title}</Text>
            <Link href="/admin" asChild>
              <Pressable style={styles.viewAllBtn}>
                <Text style={styles.complaintLinkText}>{T.feed_view_all}</Text>
                <ArrowRight size={14} color="#ea580c" />
              </Pressable>
            </Link>
          </View>

          <View style={styles.complaintsContainer}>
            {recentComplaints.map(complaint => {
              const config = ISSUE_TYPE_CONFIG[complaint.type] || ISSUE_TYPE_CONFIG['default'];
              const dateObj = new Date(complaint.created_at);
              const yyyy = dateObj.getFullYear();
              const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
              const dd = String(dateObj.getDate()).padStart(2, '0');
              const shortId = complaint.id.slice(0, 4).toUpperCase();
              const formattedId = `JS-${yyyy}${mm}${dd}-${shortId}`;

              const urgency = (complaint.urgency || 'MEDIUM').toUpperCase();
              const urgencyStyle = URGENCY_STYLES[urgency as keyof typeof URGENCY_STYLES] || URGENCY_STYLES.MEDIUM;
              const statusColor = STATUS_COLORS[complaint.status as keyof typeof STATUS_COLORS] || '#6b7280';

              return (
                <View key={complaint.id} style={styles.complaintCard}>
                  <View style={styles.complaintHeader}>
                    <View style={styles.complaintTypeRow}>
                      <View style={[styles.complaintIconContainer, { backgroundColor: config.bg }]}>
                        {config.icon}
                      </View>
                      <View>
                        <Text style={styles.complaintType}>{complaint.type}</Text>
                        <Text style={styles.complaintId}>{formattedId}</Text>
                      </View>
                    </View>
                    <View style={[styles.urgencyBadge, { backgroundColor: urgencyStyle.bg }]}>
                      <Text style={[styles.urgencyText, { color: urgencyStyle.text }]}>
                        {urgency}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.complaintDesc} numberOfLines={2}>
                    {complaint.voiceTranscript || complaint.description || '—'}
                  </Text>

                  <View style={styles.complaintFooter}>
                    <View style={styles.complaintMetaRow}>
                      <MapPin size={12} color="#9ca3af" />
                      <Text style={styles.complaintMetaText} numberOfLines={1}>
                        {complaint.area}, Ward {complaint.ward}
                      </Text>
                    </View>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {complaint.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Powerful Civic Tools */}
      <View style={[styles.section, styles.sectionBg]}>
        <Text style={styles.toolsBadge}>{T.tools_badge}</Text>
        <Text style={styles.sectionTitle}>{T.tools_title}</Text>
        <Text style={styles.sectionSubtitle}>{T.tools_subtitle}</Text>

        <View style={styles.toolsCardGrid}>
          {/* Hazard Map Card */}
          <Link href="/hazardmap" asChild>
            <Pressable style={styles.toolCardDark}>
              <View style={styles.toolHeader}>
                <View style={styles.toolIconBoxDark}>
                  <MapPin size={22} color="#f87171" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.toolBadgeDark}>
                    <Text style={styles.toolBadgeTextDark}>{T.tools_hazard_live}</Text>
                  </View>
                  <Text style={styles.toolTitleDark}>{T.tools_hazard_title}</Text>
                </View>
              </View>
              <Text style={styles.toolDescDark}>{T.tools_hazard_desc}</Text>
            </Pressable>
          </Link>

          {/* RTI Card */}
          <Link href="/rti" asChild>
            <Pressable style={styles.toolCardLight}>
              <View style={styles.toolHeader}>
                <View style={styles.toolIconBoxLight}>
                  <Scale size={22} color="#ea580c" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.toolBadgeLight}>
                    <Text style={styles.toolBadgeTextLight}>{T.tools_rti_badge}</Text>
                  </View>
                  <Text style={styles.toolTitleLight}>{T.tools_rti_title}</Text>
                </View>
              </View>
              <Text style={styles.toolDescLight}>{T.tools_rti_desc}</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {/* CTA */}
      <View style={styles.ctaSection}>
        <Text style={styles.ctaLabel}>{T.cta_badge}</Text>
        <Text style={styles.ctaText}>{T.cta_subtitle}</Text>
        <Link href="/submit" asChild>
          <Pressable style={styles.ctaBtn}>
            <Text style={styles.ctaBtnText}>{T.cta_file_btn}</Text>
            <ArrowRight size={18} color="white" />
          </Pressable>
        </Link>
      </View>

      {/* Footer */}
      <View style={styles.homeFooter}>
        <Text style={styles.homeFooterTitle}>Jan Setu</Text>
        <Text style={styles.homeFooterText}>{T.footer_tagline} 🇮🇳</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  hero: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    backgroundColor: '#fff7ed', // bg-orange-50
    alignItems: 'center',
  },
  heroLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 16,
    resizeMode: 'contain',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 36,
  },
  heroTitleOrange: {
    color: '#f97316',
  },
  heroTitleGreen: {
    color: '#16a34a',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f97316',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 13,
  },
  flagStrip: {
    flexDirection: 'row',
    width: 80,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    alignSelf: 'center',
    marginTop: 6,
  },
  flagOrange: {
    flex: 1,
    backgroundColor: '#f97316',
  },
  flagWhite: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  flagGreen: {
    flex: 1,
    backgroundColor: '#16a34a',
  },
  tagline: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '500',
  },
  statsSection: {
    backgroundColor: '#111827',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: '#9ca3af',
  },
  section: {
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  sectionBg: {
    backgroundColor: '#f9fafb',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  stepsContainer: {
    gap: 12,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 14,
    padding: 12,
  },
  stepIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f97316',
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  stepDesc: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  featuresContainer: {
    gap: 12,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 14,
    padding: 12,
  },
  featureIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  complaintHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  complaintTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  complaintLinkText: {
    color: '#ea580c',
    fontWeight: '700',
    fontSize: 13,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  complaintsContainer: {
    gap: 12,
  },
  complaintCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  complaintTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  complaintIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  complaintType: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  complaintId: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '700',
  },
  complaintDesc: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginVertical: 10,
  },
  complaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  complaintMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  complaintMetaText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Tools
  toolsBadge: {
    alignSelf: 'center',
    fontSize: 9,
    fontWeight: '700',
    color: '#ea580c',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  toolsCardGrid: {
    gap: 14,
    marginTop: 12,
  },
  toolCardDark: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 18,
    padding: 16,
  },
  toolCardLight: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 18,
    padding: 16,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  toolIconBoxDark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolIconBoxLight: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ffedd5',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBadgeDark: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    marginBottom: 4,
  },
  toolBadgeTextDark: {
    color: '#f87171',
    fontSize: 8,
    fontWeight: '700',
  },
  toolBadgeLight: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffedd5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 4,
  },
  toolBadgeTextLight: {
    color: '#ea580c',
    fontSize: 8,
    fontWeight: '700',
  },
  toolTitleDark: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  toolTitleLight: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  toolDescDark: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 16,
  },
  toolDescLight: {
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 16,
  },

  // CTA
  ctaSection: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  ctaLabel: {
    fontSize: 12,
    color: '#ea580c',
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  ctaText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f97316',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Home Footer
  homeFooter: {
    paddingVertical: 20,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeFooterTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  homeFooterText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
