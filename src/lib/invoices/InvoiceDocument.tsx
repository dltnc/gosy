import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export interface InvoiceRoomLine {
  name: string
  /** Physical rooms of this type and rate on the booking. */
  quantity: number
  nightlyRate: number | null
  /** Sum of the grouped rooms' charges, so the line prices as a line. */
  subtotal: number | null
  roomNumbers?: string[]
}

export interface InvoiceData {
  invoiceNumber: string
  issuedAt: string
  platformName: string
  currency: string
  bookingRef: string
  guestName: string
  guestEmail?: string
  propertyName: string
  propertyCity: string
  /** One entry per room type and rate booked — an invoice has to itemise what was charged. */
  rooms: InvoiceRoomLine[]
  checkInDate: string
  checkOutDate: string
  nights: number
  subtotal: number
  couponDiscountAmount: number
  pointsDiscountAmount: number
  totalAmount: number
  paymentGateway: string
  paymentTransactionId?: string
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  brand: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  invoiceMeta: {
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  muted: {
    color: '#666666',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 16,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  tableHead: {
    flexDirection: 'row',
    fontFamily: 'Helvetica-Bold',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  colRoom: {
    flex: 3,
  },
  colQty: {
    flex: 0.8,
    textAlign: 'center',
  },
  colRate: {
    flex: 1.8,
    textAlign: 'right',
  },
  colAmount: {
    flex: 1.8,
    textAlign: 'right',
  },
  roomNumbers: {
    fontSize: 8,
    color: '#666666',
    marginTop: 1,
  },
  totalsBox: {
    marginTop: 12,
    marginLeft: 'auto',
    width: 220,
    borderRadius: 4,
    backgroundColor: '#f5f7fa',
    padding: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontFamily: 'Helvetica-Bold',
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
    paddingTop: 6,
    marginTop: 2,
    fontSize: 11,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#888888',
  },
})

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const money = (amount: number, currency: string): string =>
  `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const { currency } = data
  const roomCount = data.rooms.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <Document title={data.invoiceNumber}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{data.platformName}</Text>
            <Text style={styles.muted}>Booking Invoice</Text>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceTitle}>{data.invoiceNumber}</Text>
            <Text style={styles.muted}>Issued {formatDate(data.issuedAt)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Billed To</Text>
        <Text>{data.guestName}</Text>
        {data.guestEmail ? <Text style={styles.muted}>{data.guestEmail}</Text> : null}

        <Text style={styles.sectionTitle}>Stay Details</Text>
        <View style={styles.row}>
          <Text>Booking reference</Text>
          <Text>{data.bookingRef}</Text>
        </View>
        <View style={styles.row}>
          <Text>Property</Text>
          <Text>
            {data.propertyName}, {data.propertyCity}
          </Text>
        </View>
        <View style={styles.row}>
          <Text>{roomCount > 1 ? `Rooms (${roomCount})` : 'Room'}</Text>
          <Text>
            {data.rooms.length > 0
              ? data.rooms
                  .map((line) =>
                    line.quantity > 1 ? `${line.quantity} × ${line.name}` : line.name,
                  )
                  .join(', ')
              : '—'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text>Check-in / Check-out</Text>
          <Text>
            {formatDate(data.checkInDate)} — {formatDate(data.checkOutDate)} ({data.nights} night
            {data.nights === 1 ? '' : 's'})
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Charges</Text>
        <View style={styles.tableHead}>
          <Text style={styles.colRoom}>Room</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate × nights</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>
        {data.rooms.map((line, index) => (
          <View key={`${line.name}-${line.nightlyRate ?? 'na'}-${index}`} style={styles.tableRow}>
            <View style={styles.colRoom}>
              <Text>{line.name}</Text>
              {line.roomNumbers && line.roomNumbers.length > 0 ? (
                <Text style={styles.roomNumbers}>Room {line.roomNumbers.join(', ')}</Text>
              ) : null}
            </View>
            <Text style={styles.colQty}>{line.quantity}</Text>
            <Text style={styles.colRate}>
              {line.nightlyRate != null
                ? `${money(line.nightlyRate, currency)} × ${data.nights}`
                : '—'}
            </Text>
            <Text style={styles.colAmount}>
              {line.subtotal != null ? money(line.subtotal, currency) : '—'}
            </Text>
          </View>
        ))}

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{money(data.subtotal, currency)}</Text>
          </View>
          {data.couponDiscountAmount > 0 ? (
            <View style={styles.totalRow}>
              <Text>Coupon discount</Text>
              <Text>-{money(data.couponDiscountAmount, currency)}</Text>
            </View>
          ) : null}
          {data.pointsDiscountAmount > 0 ? (
            <View style={styles.totalRow}>
              <Text>Points redemption</Text>
              <Text>-{money(data.pointsDiscountAmount, currency)}</Text>
            </View>
          ) : null}
          <View style={styles.grandTotal}>
            <Text>Total Paid</Text>
            <Text>{money(data.totalAmount, currency)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Payment</Text>
        <View style={styles.row}>
          <Text>Method</Text>
          <Text>{data.paymentGateway}</Text>
        </View>
        {data.paymentTransactionId ? (
          <View style={styles.row}>
            <Text>Transaction ID</Text>
            <Text>{data.paymentTransactionId}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          This invoice was generated automatically. Please keep it for your records.
        </Text>
      </Page>
    </Document>
  )
}

export default InvoiceDocument
