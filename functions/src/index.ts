import * as firebaseFunctions from "firebase-functions";

import * as admin from "firebase-admin";
import { Product } from "./fake-data.generator";

// let db: FirebaseFirestore.Firestore;

// Set functions region to be in europe
const functions = firebaseFunctions.region("europe-west1");

export const createOrder = functions.firestore
  .document("/orders/{orderId}")
  .onCreate(async (snapshot, context) => {
    admin.initializeApp();
    try {
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
        await calculateTotals(snapshot.id);
        await updateProductCounts(snapshot.id);
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
  const rowQuerySnapshot = await db
    .collection("rows")
    .where("orderId", "==", sourceOrderId)
    .get();
  for (const doc of rowQuerySnapshot.docs) {
    const row = doc.data();
    row.orderId = targetOrderId;
    const newRowRef = await db.collection("rows").add(row);
    console.log("row copied", newRowRef.id);
  }
  return true;
}

async function updateProductCounts(orderId: string) {
  const db = admin.firestore();
  const rowQuerySnapshot = await db
    .collection("rows")
    .where("orderId", "==", orderId)
    .get();

  for (const doc of rowQuerySnapshot.docs) {
    const row = doc.data();
    const productDoc = await db
      .collection("products")
      .doc(row.productId)
      .get();
    const product = productDoc.data() as Product;
    const productRows = await db
      .collection("rows")
      .where("productId", "==", row.productId)
      .get();
    let count = 0;
    for (const rowDoc of productRows.docs) {
      const productRow = rowDoc.data();
      count += productRow.quantity;
    }
    await productDoc.ref.update({ count, totalSales: count * product.price });
  }
  return true;
}

async function calculateTotals(orderId: string) {
  const db = admin.firestore();
  let totalPrice = 0;
  const rowQuerySnapshot = await db
    .collection("rows")
    .where("orderId", "==", orderId)
    .get();

  for (const doc of rowQuerySnapshot.docs) {
    const row = doc.data();
    totalPrice += row.quantity * row.price;
  }

  return db
    .collection("orders")
    .doc(orderId)
    .update({ totalPrice });
}
