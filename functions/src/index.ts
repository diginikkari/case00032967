import * as firebaseFunctions from "firebase-functions";

import * as admin from "firebase-admin";
import { DocumentSnapshot } from "firebase-functions/lib/providers/firestore";

admin.initializeApp();
// let db: FirebaseFirestore.Firestore;

// Set functions region to be in europe
const functions = firebaseFunctions.region("europe-west1");

export const createOrder = functions.firestore
  .document("/orders/{orderId}")
  .onCreate(async (snapshot, context) => {
    try {
      const promises: Promise<any>[] = [];
      const order = snapshot.data() as { copyOf?: string };
      if (order.copyOf) {
        console.info("Started copying salesorder rows");
        // Change status to copying
        await snapshot.ref.update({
          copyOf: admin.firestore.FieldValue.delete(),
          copying: true
        });
        const sourceOrderId = order.copyOf;
        const targetOrderId = snapshot.id;
        console.log(`copy rows from ${sourceOrderId} to ${targetOrderId}`);
        await copyRows(sourceOrderId, targetOrderId);
        console.log("all rows copied");
        promises.push(calculateTotals(snapshot.id));
        promises.push(updateProductCounts(snapshot.id));
        await Promise.all(promises);
        await snapshot.ref.update({
          copyOf: admin.firestore.FieldValue.delete()
        });
      }
      return snapshot.ref.update({ createdAt: new Date(context.timestamp) });
    } catch (error) {
      console.error("create order errored", error);
      return true;
    }
  });

async function copyRows(sourceOrderId: string, targetOrderId: string) {
  const db = admin.firestore();
  let count = 0;
  let query = db
    .collection("rows")
    .where("orderId", "==", sourceOrderId)
    .limit(100);

  let rowQuerySnapshot = await query.get();

  while (rowQuerySnapshot.size) {
    let lastItem: DocumentSnapshot | undefined;
    let batch = db.batch();
    for (const doc of rowQuerySnapshot.docs) {
      count++;
      lastItem = doc;
      const row = doc.data();
      row.orderId = targetOrderId;
      batch.create(db.collection("rows").doc(), row);
    }
    console.log(`batch writing first ${count} items`);
    await batch.commit();
    batch = db.batch();
    lastItem = rowQuerySnapshot.docs.pop();
    if (lastItem) {
      query = query.startAfter(lastItem);
      rowQuerySnapshot = await query.get();
    }
  }
  console.log("All rows are copied");
}

async function updateProductCounts(orderId: string) {
  console.log("calculating product counts");
  const promises = [];
  let rowCount = 0;
  const db = admin.firestore();
  let query = db
    .collection("rows")
    .where("orderId", "==", orderId)
    .limit(100);

  let rowQuerySnapshot = await query.get();
  const processedProducts = {} as { [productId: string]: boolean };

  while (rowQuerySnapshot.size) {
    let lastItem: DocumentSnapshot | undefined;

    for (const doc of rowQuerySnapshot.docs) {
      rowCount++;
      const row = doc.data();
      console.log(`processing row no ${rowCount} id ${doc.id}`);
      if (!processedProducts[row.productId]) {
        const productDoc = await db
          .collection("products")
          .doc(row.productId)
          .get();
        const product = productDoc.data() as { price: number };
        const productRows = await db
          .collection("rows")
          .where("productId", "==", row.productId)
          .get();
        let count = 0;
        for (const rowDoc of productRows.docs) {
          const productRow = rowDoc.data();
          count += productRow.quantity;
        }
        const totalSales = count * product.price;
        console.log(
          `Updating total sales for product ${productDoc.id} to ${totalSales}`
        );
        promises.push(
          productDoc.ref.update({
            count,
            totalSales: totalSales
          })
        );
        processedProducts[row.productId] = true;
      } else {
        console.log(`product ${row.productId} already processed.`);
      }
    }

    lastItem = rowQuerySnapshot.docs.pop();
    console.log("batch processed");
    if (lastItem) {
      query = query.startAfter(lastItem);
      rowQuerySnapshot = await query.get();
    }
  }
  return Promise.all(promises);
}

async function calculateTotals(orderId: string) {
  console.log("calculating salesorder totals");
  const db = admin.firestore();
  let totalPrice = 0;
  let count = 0;

  let query = db
    .collection("rows")
    .where("orderId", "==", orderId)
    .limit(100);
  let rowQuerySnapshot = await query.get();

  while (rowQuerySnapshot.size) {
    let lastItem: DocumentSnapshot | undefined;
    for (const doc of rowQuerySnapshot.docs) {
      count++;
      console.log(`counting row no: ${count} id: ${doc.id}`);
      const row = doc.data();
      totalPrice += row.quantity * row.price;
    }
    lastItem = rowQuerySnapshot.docs.pop();
    console.log("counted batch");
    if (lastItem) {
      query = query.startAfter(lastItem);
      rowQuerySnapshot = await query.get();
    }
  }

  return db
    .collection("orders")
    .doc(orderId)
    .update({ totalPrice });
}
