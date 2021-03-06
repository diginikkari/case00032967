"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const serviceAccount = require("../../service-account.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://issue00032967.firebaseio.com"
});
const db = admin.firestore();
const result = db
    .collection("orders")
    .add({ copyOf: "abcd1234" })
    .then(ref => console.log("order created", ref.id));
console.log(result);
//# sourceMappingURL=create-copy.js.map