import * as faker from "faker";
import * as admin from "firebase-admin";

const serviceAccount = require("../../service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://issue00032967.firebaseio.com"
});

const db = admin.firestore();

export interface Product {
  id?: string;
  name: string;
  price: number;
  color: string;
  material: string;
  department: string;
}

async function generateProducts(count = 100) {
  const products = [];
  for (let i = 0; i <= count; i++) {
    const product: Product = {
      name: faker.commerce.product(),
      color: faker.commerce.color(),
      material: faker.commerce.productMaterial(),
      department: faker.commerce.department(),
      price: faker.random.number(700)
    };
    const ref = await db.collection("products").add(product);
    products.push({ ...product, id: ref.id });
  }
  return products;
}

function generateRows(orderId: string, products: Product[], count = 100) {
  const customerDetails = faker.helpers.createCard();
  const rows = [];
  const product = faker.random.arrayElement(products);
  for (let i = 0; i <= count; i++) {
    const row = {
      customer: { ...customerDetails },
      productId: product.id,
      product: product,
      price: product.price,
      quantity: faker.random.number(100),
      orderId
    };
    rows.push(row);
  }
  return rows;
}

async function createRows() {
  const generatedProducts = await generateProducts();
  const generatedRows = generateRows("abcd1234", generatedProducts);

  for (const row of generatedRows) {
    await db.collection("rows").add(row);
  }
}

const result = createRows().then(() => console.log("created rows"));
console.log(result);
