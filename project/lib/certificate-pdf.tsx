import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer';
import { type CertificateRights, getRightsLevelLabel, type RightsLevel } from './certificate-rights';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 50,
    fontFamily: 'Helvetica',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#111111',
  },
  brandName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111111',
    letterSpacing: 4,
  },
  brandSub: {
    fontSize: 10,
    color: '#666666',
    letterSpacing: 2,
    marginTop: 2,
  },
  licenseLabel: {
    fontSize: 10,
    color: '#999999',
    letterSpacing: 1,
    textAlign: 'right',
  },
  licenseId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111111',
    textAlign: 'right',
    fontFamily: 'Courier',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 4,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 10,
    color: '#888888',
    marginBottom: 25,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  label: {
    fontSize: 9,
    color: '#888888',
    width: 130,
  },
  value: {
    fontSize: 9,
    color: '#222222',
    flex: 1,
    lineHeight: 1.5,
  },
  bulletItem: {
    flexDirection: 'row',
    paddingVertical: 2,
    paddingLeft: 10,
  },
  bullet: {
    fontSize: 9,
    color: '#999999',
    width: 12,
  },
  bulletText: {
    fontSize: 9,
    color: '#222222',
    flex: 1,
    lineHeight: 1.5,
  },
  grantedBadge: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  grantedText: {
    fontSize: 8,
    color: '#166534',
    fontWeight: 'bold',
  },
  notGrantedBadge: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  notGrantedText: {
    fontSize: 8,
    color: '#991b1b',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 12,
  },
  footerText: {
    fontSize: 8,
    color: '#aaaaaa',
  },
  qrContainer: {
    width: 60,
    height: 60,
  },
  qrImage: {
    width: 60,
    height: 60,
  },
  watermark: {
    position: 'absolute',
    top: '45%',
    left: '20%',
    fontSize: 60,
    color: '#f5f5f5',
    letterSpacing: 10,
    transform: 'rotate(-30deg)',
    fontWeight: 'bold',
  },
});

interface CertificateData {
  licenseId: string;
  issueDate: string;
  clientName?: string;
  clientEmail?: string;
  clientTaxId?: string;
  clientContactPerson?: string;
  clientCountry?: string;
  projectName: string;
  productCategory: string;
  assetType: string;
  rightsLevel: RightsLevel;
  rights: CertificateRights;
  talentName?: string;
  audioSpecs?: string;
  qrCodeDataUrl?: string;
}

function CertificateDocument({ data }: { data: CertificateData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>ONYX</Text>

        {/* Header */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.brandName}>ONYX</Text>
            <Text style={styles.brandSub}>STUDIOS</Text>
          </View>
          <View>
            <Text style={styles.licenseLabel}>LICENSE ID</Text>
            <Text style={styles.licenseId}>#{data.licenseId}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>LICENSE CERTIFICATE</Text>
        <Text style={styles.subtitle}>OFFICIAL RIGHTS GRANT — {data.issueDate}</Text>

        {/* Licensed To */}
        {data.clientName && (
          <View style={{ marginBottom: 20, padding: 12, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4 }}>
            <View style={styles.row}>
              <Text style={{ ...styles.label, fontWeight: 'bold', color: '#333333' }}>Licensed To</Text>
              <Text style={{ ...styles.value, fontWeight: 'bold', fontSize: 11 }}>{data.clientName}</Text>
            </View>
            {data.clientTaxId && (
              <View style={styles.row}>
                <Text style={styles.label}>Tax / Reg. No.</Text>
                <Text style={styles.value}>{data.clientTaxId}</Text>
              </View>
            )}
            {data.clientContactPerson && (
              <View style={styles.row}>
                <Text style={styles.label}>Contact Person</Text>
                <Text style={styles.value}>{data.clientContactPerson}</Text>
              </View>
            )}
            {data.clientEmail && (
              <View style={styles.row}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{data.clientEmail}</Text>
              </View>
            )}
            {data.clientCountry && (
              <View style={styles.row}>
                <Text style={styles.label}>Country</Text>
                <Text style={styles.value}>{data.clientCountry}</Text>
              </View>
            )}
          </View>
        )}

        {/* Section 1: Project Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Project Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>License ID</Text>
            <Text style={styles.value}>#{data.licenseId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Issue Date</Text>
            <Text style={styles.value}>{data.issueDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Project Name</Text>
            <Text style={styles.value}>{data.projectName || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Product Category</Text>
            <Text style={styles.value}>{data.productCategory}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Asset Type</Text>
            <Text style={styles.value}>{data.assetType}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Rights Level</Text>
            <Text style={styles.value}>{getRightsLevelLabel(data.rightsLevel)}</Text>
          </View>
          {data.audioSpecs && (
            <View style={styles.row}>
              <Text style={styles.label}>Audio Specs</Text>
              <Text style={styles.value}>{data.audioSpecs}</Text>
            </View>
          )}
        </View>

        {/* Section 2: Scope of Licensing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Scope of Licensing</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Validity Period</Text>
            <Text style={styles.value}>{data.rights.validityPeriod}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Geographic Territory</Text>
            <Text style={styles.value}>{data.rights.geographicTerritory}</Text>
          </View>
          <View style={{ ...styles.row, marginTop: 4 }}>
            <Text style={styles.label}>Media Channels</Text>
            <View style={{ flex: 1 }}>
              {data.rights.mediaChannels.map((ch, i) => (
                <View key={i} style={styles.bulletItem}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{ch}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ ...styles.row, marginTop: 6 }}>
            <Text style={styles.label}>Sublicensing Rights</Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={data.rights.sublicensingRights.granted ? styles.grantedBadge : styles.notGrantedBadge}>
                <Text style={data.rights.sublicensingRights.granted ? styles.grantedText : styles.notGrantedText}>
                  {data.rights.sublicensingRights.granted ? 'GRANTED' : 'NOT INCLUDED'}
                </Text>
              </View>
            </View>
          </View>
          <View style={{ paddingLeft: 130, paddingTop: 2 }}>
            <Text style={{ fontSize: 8, color: '#666666', lineHeight: 1.4 }}>{data.rights.sublicensingRights.note}</Text>
          </View>
          <View style={{ ...styles.row, marginTop: 6 }}>
            <Text style={styles.label}>Distribution Rights</Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={data.rights.distributionRights.granted ? styles.grantedBadge : styles.notGrantedBadge}>
                <Text style={data.rights.distributionRights.granted ? styles.grantedText : styles.notGrantedText}>
                  {data.rights.distributionRights.granted ? 'GRANTED' : 'NOT INCLUDED'}
                </Text>
              </View>
            </View>
          </View>
          <View style={{ paddingLeft: 130, paddingTop: 2 }}>
            <Text style={{ fontSize: 8, color: '#666666', lineHeight: 1.4 }}>{data.rights.distributionRights.note}</Text>
          </View>
        </View>

        {/* Section 3: Ownership & Legal Affidavit */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Ownership & Legal Affidavit</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Ownership Status</Text>
            <Text style={styles.value}>{data.rights.ownershipStatus}</Text>
          </View>
          {data.talentName && (
            <View style={styles.row}>
              <Text style={styles.label}>Performer</Text>
              <Text style={styles.value}>{data.talentName}</Text>
            </View>
          )}
          {data.rights.voiceAffidavit.included && (
            <View style={styles.row}>
              <Text style={styles.label}>Voice Affidavit</Text>
              <Text style={styles.value}>{data.rights.voiceAffidavit.note}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Indemnification</Text>
            <Text style={styles.value}>{data.rights.indemnification}</Text>
          </View>
        </View>

        {/* Section 4: Creative Freedom */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Onyx Creative Freedom Clause</Text>
          <View style={{ paddingLeft: 10 }}>
            <Text style={{ fontSize: 8, color: '#444444', lineHeight: 1.6 }}>
              All performers associated with this project have irrevocably agreed not to assert any moral rights (including the right of attribution and right of integrity) against the Licensee. The Licensee is free to edit, remix, adapt, or incorporate this asset into derivative works without restriction. Any derivative works created from this asset remain subject to all restrictions set forth in the Terms of Service, including the AI Training Ban (Section 5 below).
            </Text>
          </View>
        </View>

        {/* Section 5: Prohibited Use — AI Training */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Prohibited Use: AI Training & Machine Learning</Text>
          <View style={{ paddingLeft: 10 }}>
            <Text style={{ fontSize: 8, color: '#444444', lineHeight: 1.6 }}>
              The Licensee is strictly prohibited from using the Licensed Asset (including but not limited to vocals, music, stems, and arrangements) for the purpose of training, developing, or refining any artificial intelligence, machine learning models, voice cloning technology, or synthetic media generators. Any such use will result in immediate and automatic revocation of this license without refund, and the Licensor reserves the right to pursue legal action for intellectual property infringement and any resulting damages.
            </Text>
            <Text style={{ fontSize: 8, color: '#444444', lineHeight: 1.6, marginTop: 4 }}>
              Enforcement: Upon reasonable suspicion, Onyx Studios may require written certification of compliance. Unauthorized use shall entitle Onyx Studios to compensation of ten (10) times the original license fee, in addition to injunctive relief from a court of competent jurisdiction.
            </Text>
          </View>
        </View>

        {/* Section 6: License Conditions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. License Conditions</Text>
          <View style={{ ...styles.row, marginBottom: 2 }}>
            <Text style={styles.label}>Transferability</Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={data.rights.transferability.transferable ? styles.grantedBadge : styles.notGrantedBadge}>
                <Text style={data.rights.transferability.transferable ? styles.grantedText : styles.notGrantedText}>
                  {data.rights.transferability.transferable ? 'TRANSFERABLE' : 'NON-TRANSFERABLE'}
                </Text>
              </View>
            </View>
          </View>
          <View style={{ paddingLeft: 130, paddingBottom: 4 }}>
            <Text style={{ fontSize: 8, color: '#666666', lineHeight: 1.4 }}>{data.rights.transferability.note}</Text>
          </View>
          <View style={{ paddingLeft: 10 }}>
            <Text style={{ fontSize: 8, color: '#444444', lineHeight: 1.6 }}>
              No Resale: The Licensee may not repackage or resell the Licensed Asset as a standalone audio product to third-party libraries.
            </Text>
            <Text style={{ fontSize: 8, color: '#444444', lineHeight: 1.6, marginTop: 2 }}>
              Digital Watermarking: Onyx Studios reserves the right to embed, now or in the future, invisible digital watermarks or fingerprints into delivered assets for license verification and copyright protection.
            </Text>
            <Text style={{ fontSize: 8, color: '#444444', lineHeight: 1.6, marginTop: 2 }}>
              Scope Exceedance: Use beyond the purchased license scope shall incur the applicable license upgrade fee plus a 25% administrative surcharge.
            </Text>
            <Text style={{ fontSize: 8, color: '#444444', lineHeight: 1.6, marginTop: 2 }}>
              Business Continuity: This license is perpetual and shall not be affected by any changes in Onyx Studios&apos; business status, including merger, acquisition, or dissolution, nor by any changes in the engagement status of the Talent whose voice or performance was used to create this asset.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerText}>Onyx Studios — www.onyxstudios.ai</Text>
            <Text style={styles.footerText}>Questions? support@onyxstudios.ai</Text>
            <Text style={{ ...styles.footerText, marginTop: 4 }}>
              Verify: www.onyxstudios.ai/verify/{data.licenseId}
            </Text>
            <Text style={{ ...styles.footerText, marginTop: 4, fontStyle: 'italic' }}>
              This Certificate is issued subject to the Master Terms of Service at www.onyxstudios.ai/legal/terms and the Acceptable Use Policy at www.onyxstudios.ai/legal/aup
            </Text>
          </View>
          {data.qrCodeDataUrl && (
            <View style={styles.qrContainer}>
              <Image src={data.qrCodeDataUrl} style={styles.qrImage} />
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  const buffer = await renderToBuffer(<CertificateDocument data={data} />);
  return Buffer.from(buffer);
}
