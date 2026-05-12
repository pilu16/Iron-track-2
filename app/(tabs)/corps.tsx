import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  useMeasurements,
  type MeasurementRow,
  type MeasurementType,
} from '../../hooks/useMeasurements';
import {
  ACCENT,
  BACKGROUND,
  BORDER,
  HAZARD,
  SURFACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../constants/colors';
import { FONT_MONO, FONT_MONO_BOLD, FONT_MONO_MEDIUM } from '../../constants/fonts';

const MEASURE_TYPES: Array<{ type: MeasurementType; label: string; unit: string }> = [
  { type: 'poids', label: 'POIDS', unit: 'kg' },
  { type: 'tour_bras_g', label: 'BRAS (G)', unit: 'cm' },
  { type: 'tour_bras_d', label: 'BRAS (D)', unit: 'cm' },
  { type: 'tour_poitrine', label: 'POITRINE', unit: 'cm' },
  { type: 'tour_taille', label: 'TAILLE', unit: 'cm' },
  { type: 'tour_hanches', label: 'HANCHES', unit: 'cm' },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function getLatestByType(
  measurements: MeasurementRow[],
  type: MeasurementType
): MeasurementRow | undefined {
  return measurements.find((m) => m.type === type);
}

function getPrevByType(
  measurements: MeasurementRow[],
  type: MeasurementType
): MeasurementRow | undefined {
  const matches = measurements.filter((m) => m.type === type);
  return matches[1];
}

function WeightSparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return <View style={sparkStyles.empty} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const barW = 20;
  const gap = 4;
  const h = 60;

  return (
    <View style={[sparkStyles.container, { height: h }]}>
      {data.map((val, i) => {
        const barH = Math.max(4, Math.round(((val - min) / range) * (h - 8)) + 4);
        const isLast = i === data.length - 1;
        return (
          <View key={i} style={[sparkStyles.barWrap, { width: barW, marginRight: gap }]}>
            <View style={sparkStyles.barTrack}>
              <View
                style={[
                  sparkStyles.bar,
                  {
                    height: barH,
                    backgroundColor: isLast ? ACCENT : ACCENT + '55',
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  empty: { height: 60, backgroundColor: SURFACE },
  container: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8 },
  barWrap: {},
  barTrack: { flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%' },
});

interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (type: MeasurementType, value: number) => Promise<void>;
}

function AddMeasurementModal({ visible, onClose, onSave }: AddModalProps) {
  const [selectedType, setSelectedType] = useState<MeasurementType>('poids');
  const [valueInput, setValueInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave() {
    const v = parseFloat(valueInput.replace(',', '.'));
    if (isNaN(v) || v <= 0) {
      setErr('Valeur invalide.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await onSave(selectedType, v);
      setValueInput('');
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  const selectedMeta = MEASURE_TYPES.find((t) => t.type === selectedType)!;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={modalStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={modalStyles.sheet}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>NOUVELLE MESURE</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={modalStyles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={modalStyles.fieldLabel}>TYPE DE MESURE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modalStyles.typeRow}>
            {MEASURE_TYPES.map((mt) => (
              <TouchableOpacity
                key={mt.type}
                style={[
                  modalStyles.typeChip,
                  selectedType === mt.type && modalStyles.typeChipActive,
                ]}
                onPress={() => setSelectedType(mt.type)}
              >
                <Text
                  style={[
                    modalStyles.typeChipText,
                    selectedType === mt.type && modalStyles.typeChipTextActive,
                  ]}
                >
                  {mt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={modalStyles.fieldLabel}>VALEUR ({selectedMeta.unit.toUpperCase()})</Text>
          <TextInput
            style={modalStyles.input}
            value={valueInput}
            onChangeText={setValueInput}
            keyboardType="decimal-pad"
            placeholder={selectedMeta.type === 'poids' ? '80,5' : '38,0'}
            placeholderTextColor={TEXT_SECONDARY}
            selectTextOnFocus
          />

          {err ? <Text style={modalStyles.error}>{err}</Text> : null}

          <TouchableOpacity
            style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={modalStyles.saveBtnText}>
              {saving ? 'ENREGISTREMENT...' : 'ENREGISTRER'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    backgroundColor: BACKGROUND,
    borderTopWidth: 1,
    borderTopColor: ACCENT,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontFamily: FONT_MONO_BOLD, fontSize: 14, color: TEXT_PRIMARY, letterSpacing: 2 },
  closeBtn: { fontFamily: FONT_MONO_BOLD, fontSize: 16, color: TEXT_SECONDARY },
  fieldLabel: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 3,
    marginBottom: 8,
  },
  typeRow: { marginBottom: 16 },
  typeChip: {
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 6,
    backgroundColor: SURFACE,
  },
  typeChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  typeChipText: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 1 },
  typeChipTextActive: { color: BACKGROUND },
  input: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    color: TEXT_PRIMARY,
    fontFamily: FONT_MONO_BOLD,
    fontSize: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    letterSpacing: 2,
  },
  error: { fontFamily: FONT_MONO, fontSize: 11, color: HAZARD, marginBottom: 12 },
  saveBtn: { backgroundColor: ACCENT, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontFamily: FONT_MONO_BOLD, fontSize: 13, color: BACKGROUND, letterSpacing: 3 },
});

export default function CorpsScreen() {
  const { measurements, loading, refetch, insertMeasurement } = useMeasurements();
  const [modalVisible, setModalVisible] = useState(false);

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const latestWeight = getLatestByType(measurements, 'poids');
  const prevWeight = getPrevByType(measurements, 'poids');
  const weightDelta =
    latestWeight && prevWeight ? latestWeight.value - prevWeight.value : null;

  const weightHistory = measurements
    .filter((m) => m.type === 'poids')
    .slice(0, 10)
    .reverse()
    .map((m) => m.value);

  const firstWeight = measurements
    .filter((m) => m.type === 'poids')
    .slice(-1)[0];

  const totalDelta =
    latestWeight && firstWeight && latestWeight.id !== firstWeight.id
      ? latestWeight.value - firstWeight.value
      : null;

  const totalDays =
    latestWeight && firstWeight && latestWeight.id !== firstWeight.id
      ? daysAgo(firstWeight.measured_at)
      : null;

  async function handleSaveMeasurement(type: MeasurementType, value: number) {
    await insertMeasurement({ type, value });
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.inner}>
      <Text style={styles.sectionNum}>SECTION 04</Text>
      <Text style={styles.screenTitle}>MENSURATIONS.</Text>

      <View style={styles.photoDiptych}>
        <View style={styles.photoBox}>
          <Text style={styles.photoLabel}>AVANT</Text>
          <View style={styles.photoPlaceholder}>
            <View style={styles.silhouetteHead} />
            <View style={styles.silhouetteBody} />
          </View>
          <Text style={styles.photoDate}>
            {firstWeight ? `${formatDate(firstWeight.measured_at)} · ${firstWeight.value.toFixed(1).replace('.', ',')} KG` : '—'}
          </Text>
        </View>
        <View style={styles.photoDivider} />
        <View style={styles.photoBox}>
          <Text style={styles.photoLabel}>MAINT.</Text>
          <View style={styles.photoPlaceholder}>
            <View style={styles.silhouetteHead} />
            <View style={styles.silhouetteBody} />
          </View>
          <Text style={styles.photoDate}>
            {latestWeight ? `${formatDate(latestWeight.measured_at)} · ${latestWeight.value.toFixed(1).replace('.', ',')} KG` : '—'}
          </Text>
        </View>
      </View>

      {totalDelta !== null && totalDays !== null && (
        <View style={styles.deltaBadge}>
          <Text style={styles.deltaBadgeText}>
            {totalDelta >= 0 ? '+' : ''}{totalDelta.toFixed(1).replace('.', ',')} KG · {totalDays} JOURS
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>POIDS CORPOREL</Text>
            <View style={styles.weightRow}>
              <Text style={styles.weightValue}>
                {latestWeight
                  ? latestWeight.value.toFixed(1).replace('.', ',')
                  : '—'}
                <Text style={styles.weightUnit}> KG</Text>
              </Text>
              {weightDelta !== null && (
                <Text style={[styles.weightDelta, { color: weightDelta > 0 ? HAZARD : ACCENT }]}>
                  {weightDelta >= 0 ? '↑' : '↓'} {weightDelta >= 0 ? '+' : ''}
                  {weightDelta.toFixed(1).replace('.', ',')} KG
                </Text>
              )}
            </View>
            {weightHistory.length > 0 && <WeightSparkline data={weightHistory} />}
          </View>

          <View style={styles.block}>
            <View style={styles.blockLabelRow}>
              <Text style={styles.blockLabel}>TOUTES LES MESURES</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.addBtnText}>+ NOUVELLE</Text>
              </TouchableOpacity>
            </View>

            {MEASURE_TYPES.map((mt) => {
              const latest = getLatestByType(measurements, mt.type);
              const prev = getPrevByType(measurements, mt.type);
              const delta = latest && prev ? latest.value - prev.value : null;
              return (
                <View key={mt.type} style={styles.measureRow}>
                  <View style={styles.measureLeft}>
                    <Text style={styles.measureName}>{mt.label}</Text>
                    {latest && (
                      <Text style={styles.measureDate}>
                        {formatDate(latest.measured_at)} · IL Y A {daysAgo(latest.measured_at)} J
                      </Text>
                    )}
                  </View>
                  <View style={styles.measureRight}>
                    {latest ? (
                      <>
                        <Text style={styles.measureValue}>
                          {latest.value.toFixed(1).replace('.', ',')}
                          <Text style={styles.measureUnit}> {mt.unit.toUpperCase()}</Text>
                        </Text>
                        {delta !== null && (
                          <Text
                            style={[
                              styles.measureDelta,
                              { color: delta > 0 ? (mt.type === 'poids' ? HAZARD : ACCENT) : ACCENT },
                            ]}
                          >
                            {delta >= 0 ? '+' : ''}{delta.toFixed(1).replace('.', ',')}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.measureEmpty}>—</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      <AddMeasurementModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveMeasurement}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BACKGROUND },
  inner: { paddingTop: 56, paddingBottom: 40, paddingHorizontal: 16 },

  sectionNum: { fontFamily: FONT_MONO, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 3, marginBottom: 4 },
  screenTitle: { fontFamily: FONT_MONO_BOLD, fontSize: 36, color: TEXT_PRIMARY, letterSpacing: 3, marginBottom: 24 },

  photoDiptych: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 0,
  },
  photoBox: { flex: 1, padding: 12, alignItems: 'center' },
  photoDivider: { width: 1, backgroundColor: BORDER },
  photoLabel: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 3,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  photoPlaceholder: {
    width: 64,
    height: 96,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    marginBottom: 8,
  },
  silhouetteHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BORDER,
    marginBottom: 4,
  },
  silhouetteBody: {
    width: 32,
    height: 56,
    backgroundColor: BORDER,
  },
  photoDate: { fontFamily: FONT_MONO, fontSize: 9, color: TEXT_SECONDARY, textAlign: 'center' },

  deltaBadge: {
    borderWidth: 1,
    borderColor: ACCENT,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  deltaBadgeText: { fontFamily: FONT_MONO_BOLD, fontSize: 13, color: ACCENT, letterSpacing: 2 },

  loadingBox: { paddingTop: 40, alignItems: 'center' },

  block: { marginBottom: 20, borderWidth: 1, borderColor: BORDER },
  blockLabel: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  blockLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },

  weightRow: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4, gap: 4 },
  weightValue: { fontFamily: FONT_MONO_BOLD, fontSize: 40, color: TEXT_PRIMARY, letterSpacing: 2 },
  weightUnit: { fontFamily: FONT_MONO, fontSize: 18, color: TEXT_SECONDARY },
  weightDelta: { fontFamily: FONT_MONO_BOLD, fontSize: 13, letterSpacing: 1 },

  addBtn: {
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addBtnText: { fontFamily: FONT_MONO_BOLD, fontSize: 9, color: ACCENT, letterSpacing: 2 },

  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  measureLeft: { flex: 1, gap: 2 },
  measureName: { fontFamily: FONT_MONO_BOLD, fontSize: 11, color: TEXT_PRIMARY, letterSpacing: 1 },
  measureDate: { fontFamily: FONT_MONO, fontSize: 9, color: TEXT_SECONDARY, letterSpacing: 0.5 },
  measureRight: { alignItems: 'flex-end', gap: 2 },
  measureValue: { fontFamily: FONT_MONO_BOLD, fontSize: 16, color: TEXT_PRIMARY },
  measureUnit: { fontFamily: FONT_MONO, fontSize: 10, color: TEXT_SECONDARY },
  measureDelta: { fontFamily: FONT_MONO_MEDIUM, fontSize: 10, letterSpacing: 1 },
  measureEmpty: { fontFamily: FONT_MONO, fontSize: 14, color: TEXT_SECONDARY },
});
