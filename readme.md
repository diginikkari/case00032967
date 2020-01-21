# Reproduction of support Case 00032967 and https://github.com/firebase/firebase-functions/issues/611#issuecomment-576473183

This is simplified reproduction of issue with firebase function ending unespectly with `finished with status: 'connection error'`.

Reproduction steps:

1. create firestore project
2. Initialize firestore database for project
3. get service account credentials and save it root folder with name: `service-account.json`
4. Build and deploy functions `npm run build; npm run deploy`
5. Generate fake test data `npm run generate-fake-data`
6. Call function which add order document to firestore, which then triggers the firestore function trigger `npm run create-order-copy`
7. check logs `npm run logs`
