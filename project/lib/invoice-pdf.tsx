import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 50,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#111111',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  brandName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 10,
    color: '#888888',
    marginTop: 3,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: -0.8,
    textAlign: 'right',
  },
  invoiceNum: {
    fontSize: 11,
    color: '#555555',
    marginTop: 3,
    textAlign: 'right',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    marginBottom: 24,
  },
  twoCols: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 28,
  },
  col: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#999999',
    marginBottom: 6,
  },
  sectionValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 2,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  paidDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  paidText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#15803d',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#111111',
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#555555',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 12,
  },
  cellDesc: {
    flex: 3,
  },
  cellDetails: {
    flex: 2,
    fontSize: 11,
    color: '#444444',
  },
  cellAmount: {
    flex: 1,
    textAlign: 'right',
    fontWeight: 'bold',
    fontSize: 12,
  },
  itemName: {
    fontWeight: 'bold',
    color: '#111111',
    fontSize: 12,
  },
  itemDesc: {
    fontSize: 9,
    color: '#888888',
    marginTop: 3,
  },
  totals: {
    alignItems: 'flex-end',
    marginTop: 16,
    gap: 6,
  },
  totalRow: {
    flexDirection: 'row',
    gap: 40,
    fontSize: 11,
    color: '#555555',
  },
  totalFinal: {
    flexDirection: 'row',
    gap: 40,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    borderTopWidth: 2,
    borderTopColor: '#111111',
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    width: 80,
  },
  totalValue: {
    width: 100,
    textAlign: 'right',
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
    paddingTop: 16,
  },
  footerNote: {
    fontSize: 9,
    color: '#aaaaaa',
    maxWidth: 280,
    lineHeight: 1.6,
  },
  footerTxn: {
    fontSize: 8,
    color: '#bbbbbb',
    marginTop: 4,
    fontFamily: 'Courier',
  },
  footerBrand: {
    fontSize: 9,
    color: '#aaaaaa',
    textAlign: 'right',
  },
  footerUrl: {
    fontSize: 8,
    color: '#cccccc',
    marginTop: 2,
    textAlign: 'right',
  },
});

interface InvoiceParams {
  orderNum: string;
  paidDate: string;
  billingName: string;
  billingCompany: string;
  billingVat: string;
  billingEmail: string;
  billingAddress: string;
  billingCountry: string;
  displayName: string;
  itemType: string;
  itemDetails: string;
  price: string;
  transactionId: string;
}

function InvoiceDocument(props: InvoiceParams) {
  const {
    orderNum, paidDate, billingName, billingCompany, billingVat,
    billingEmail, billingAddress, billingCountry, displayName,
    itemType, itemDetails, price, transactionId,
  } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>Onyx Studios</Text>
            <Text style={styles.brandSub}>Professional Voice &amp; Music Production</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNum}>#{orderNum}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.twoCols}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Billed To</Text>
            {billingName && billingName !== billingEmail && (
              <Text style={styles.sectionValue}>{billingName}</Text>
            )}
            {billingCompany ? <Text style={[styles.sectionSub, { fontWeight: 'bold' }]}>{billingCompany}</Text> : null}
            {billingVat ? <Text style={styles.sectionSub}>VAT / Tax ID: {billingVat}</Text> : null}
            <Text style={styles.sectionSub}>{billingEmail}</Text>
            {billingAddress ? <Text style={styles.sectionSub}>{billingAddress}</Text> : null}
            {billingCountry ? <Text style={styles.sectionSub}>{billingCountry}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Invoice Details</Text>
            <Text style={styles.sectionValue}>Date: {paidDate}</Text>
            <Text style={styles.sectionSub}>Order: #{orderNum}</Text>
            <View style={styles.paidBadge}>
              <View style={styles.paidDot} />
              <Text style={styles.paidText}>Paid</Text>
            </View>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Description</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Details</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Amount</Text>
        </View>

        <View style={styles.tableRow}>
          <View style={styles.cellDesc}>
            <Text style={styles.itemName}>{displayName}</Text>
            <Text style={styles.itemDesc}>{itemType}</Text>
          </View>
          <Text style={styles.cellDetails}>{itemDetails}</Text>
          <Text style={styles.cellAmount}>US${price}</Text>
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>US${price}</Text>
          </View>
          <View style={styles.totalFinal}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>US${price}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.footerNote}>
              Thank you for your order. For questions regarding this invoice, please contact us at billing@onyxstudios.ai
            </Text>
            <Text style={styles.footerTxn}>Transaction ID: {transactionId}</Text>
          </View>
          <View>
            <Text style={styles.footerBrand}>Onyx Studios</Text>
            <Text style={styles.footerUrl}>www.onyxstudios.ai</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function generateInvoicePdf(params: InvoiceParams): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument {...params} />);
}
