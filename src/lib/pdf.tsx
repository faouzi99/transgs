import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReportSection, ReportSpec } from "./report-spec";

const INK = "#1C2430";
const ACCENT = "#E08A1E";
const MUTED = "#5A6676";
const LINE = "#DDE2E8";

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 48, paddingHorizontal: 28, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  brandAccent: { color: ACCENT },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderBottomColor: ACCENT, paddingBottom: 6, marginBottom: 10 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  metaItem: { marginRight: 16, marginBottom: 2 },
  metaLabel: { color: MUTED, fontSize: 7, textTransform: "uppercase" },
  metaValue: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 4, textTransform: "uppercase" },
  table: { borderTopWidth: 1, borderTopColor: INK },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE, minHeight: 14, alignItems: "center" },
  th: { backgroundColor: "#F1F4F7", fontFamily: "Helvetica-Bold", fontSize: 7.5, color: MUTED, textTransform: "uppercase" },
  cell: { flex: 1, paddingHorizontal: 3, paddingVertical: 2.5 },
  right: { textAlign: "right" },
  ok: { color: "#1F8A4C", fontFamily: "Helvetica-Bold" },
  bad: { color: "#C62828", fontFamily: "Helvetica-Bold" },
  empty: { color: MUTED, fontStyle: "italic", paddingVertical: 4 },
  totals: { marginTop: 10, borderWidth: 1, borderColor: INK, padding: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  footer: { position: "absolute", left: 28, right: 28, bottom: 18, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 4, fontSize: 7, color: MUTED },
});

// The standard PDF fonts have no glyph for the narrow/no-break spaces used by fr-FR number formatting.
const t = (v: string | number) => String(v).replace(/[\u202F\u00A0]/g, " ");

function Section({ section }: { section: ReportSection }) {
  const right = new Set(section.alignRight ?? []);
  return (
    <View wrap>
      <Text style={s.sectionTitle}>{section.titre}</Text>
      {section.lignes.length === 0 ? (
        <Text style={s.empty}>{section.vide ?? "Aucune ligne."}</Text>
      ) : (
        <View style={s.table}>
          <View style={[s.tr, s.th]} fixed>
            {section.colonnes.map((c, i) => (
              <Text key={i} style={[s.cell, right.has(i) ? s.right : {}]}>{c}</Text>
            ))}
          </View>
          {section.lignes.map((row, r) => (
            <View key={r} style={s.tr} wrap={false}>
              {row.map((v, i) => {
                const tone = section.tones?.[r]?.[i];
                return (
                  <Text key={i} style={[s.cell, right.has(i) ? s.right : {}, tone === "ok" ? s.ok : tone === "bad" ? s.bad : {}]}>
                    {t(v)}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ReportDocument({ spec }: { spec: ReportSpec }) {
  return (
    <Document title={spec.titre} author={spec.pied.auteur} creator="TRANSWIN">
      <Page size="A4" orientation={spec.sections.some((x) => x.colonnes.length > 6) ? "landscape" : "portrait"} style={s.page}>
        <View style={s.header} fixed>
          <Text style={s.brand}>
            TRANS<Text style={s.brandAccent}>WIN</Text>
          </Text>
          <Text style={{ color: MUTED }}>Suivi maintenance, engins et lubrifiants</Text>
        </View>
        <Text style={s.title}>{spec.titre}</Text>
        <View style={s.metaRow}>
          {spec.entete.map(([k, v]) => (
            <View key={k} style={s.metaItem}>
              <Text style={s.metaLabel}>{k}</Text>
              <Text style={s.metaValue}>{t(v)}</Text>
            </View>
          ))}
        </View>
        {spec.sections.map((sec, i) => (
          <Section key={i} section={sec} />
        ))}
        {spec.totaux && spec.totaux.length > 0 && (
          <View style={s.totals} wrap={false}>
            {spec.totaux.map(([k, v]) => (
              <View key={k} style={s.totalRow}>
                <Text>{k}</Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{t(v)}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={s.footer} fixed>
          <Text>{t(`Site : ${spec.pied.site} · Période : ${spec.pied.periode}`)}</Text>
          <Text>{t(`Édité le ${spec.pied.dateEdition} par ${spec.pied.auteur}`)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(spec: ReportSpec): Promise<Buffer> {
  return renderToBuffer(<ReportDocument spec={spec} />);
}
