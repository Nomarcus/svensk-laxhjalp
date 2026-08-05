import { APPLE_SUBSCRIPTION_PRODUCT_IDS } from '../config';
import { restoreApplePurchases, verifyApplePurchase } from './api';

export type StoreProduct = {
  productId: string;
  title?: string;
  description?: string;
  localizedPrice?: string;
};

export async function loadSubscriptionProducts(): Promise<StoreProduct[]> {
  const iap = await import('react-native-iap');
  await iap.initConnection();
  const products = await iap.getSubscriptions({ skus: APPLE_SUBSCRIPTION_PRODUCT_IDS });
  return products.map((product) => ({
    productId: product.productId,
    title: product.title,
    description: product.description,
    localizedPrice: 'localizedPrice' in product ? String(product.localizedPrice || '') : undefined,
  }));
}

export async function purchaseSubscription(productId: string) {
  const iap = await import('react-native-iap');
  await iap.initConnection();
  const purchase = await iap.requestSubscription({ sku: productId });
  const item = Array.isArray(purchase) ? purchase[0] : purchase;
  if (!item) throw new Error('Köpet kunde inte slutföras.');
  const status = await verifyApplePurchase({
    productId,
    transactionId: item.transactionId,
    originalTransactionId: 'originalTransactionIdentifierIOS' in item ? String(item.originalTransactionIdentifierIOS || '') : undefined,
    transactionReceipt: item.transactionReceipt,
  });
  await iap.finishTransaction({ purchase: item, isConsumable: false });
  return status;
}

export async function restoreLatestSubscription() {
  const iap = await import('react-native-iap');
  await iap.initConnection();
  const purchases = await iap.getAvailablePurchases();
  const latest = purchases.find((purchase) => APPLE_SUBSCRIPTION_PRODUCT_IDS.includes(purchase.productId));
  if (!latest) throw new Error('Ingen tidigare Apple-prenumeration hittades.');
  return restoreApplePurchases({
    originalTransactionId: 'originalTransactionIdentifierIOS' in latest ? String(latest.originalTransactionIdentifierIOS || '') : undefined,
    transactionReceipt: latest.transactionReceipt,
  });
}
