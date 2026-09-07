"use client";

import Link from "next/link";
import { useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/routes";
import { useCartQuery } from "@/features/cart/hooks/use-cart-query";
import { formatPrice, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_HINTS, PAYMENT_METHOD_LABELS } from "../lib/format";
import { useCheckout } from "../hooks/use-checkout";
import type { PaymentMethod, ShippingAddress } from "../types";

/**
 * The payment methods actually offered.
 *
 * `CARD` is in the API's enum but deliberately absent: there is no card
 * gateway on the server, so an order placed with it could never be paid.
 * Offering it would be a promise the marketplace cannot keep.
 */
const OFFERED_METHODS: PaymentMethod[] = ["COD", "ESEWA"];

/** Keys match the server's `shippingAddressSchema`, so error paths line up. */
type AddressField = keyof ShippingAddress;

const EMPTY_ADDRESS: ShippingAddress = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "Nepal",
};

/**
 * The checkout: address, payment method, a review of what is being bought,
 * and the button that places the order.
 *
 * The totals shown here are the cart's own, fetched on the server by the
 * page — this form never computes money. The order that comes back is priced
 * from the cart again at the moment of checkout, which is what makes a price
 * change between these two screens the server's problem to report rather
 * than a silent difference in what gets charged.
 */
export function CheckoutForm({
  defaultName,
}: {
  /** The account's name, as a starting point for the delivery name. */
  defaultName: string;
}) {
  // Read from the shared cache, seeded by the page — so this renders with the
  // cart already in hand, and stays in step with it rather than holding a
  // copy that was passed down once and can no longer change.
  const { data: cart } = useCartQuery();
  const { placeOrder, isPlacing, error, fieldErrors } = useCheckout();

  const [address, setAddress] = useState<ShippingAddress>({
    ...EMPTY_ADDRESS,
    fullName: defaultName,
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [notes, setNotes] = useState("");

  const set = (field: AddressField) => (value: string) => {
    setAddress((current) => ({ ...current, [field]: value }));
  };

  // After every hook, so the early return cannot reorder them. The page seeds
  // the cache before this renders, so this only trips if the cart was
  // invalidated out from under the form — another tab emptying it, say.
  if (!cart) {
    return <Skeleton className="h-96 rounded-2xl" />;
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    void placeOrder({
      shippingAddress: {
        ...address,
        // The schema takes `line2` as nullable-optional; an empty box means
        // "no second line", not an empty string to store.
        line2: address.line2?.trim() ? address.line2.trim() : null,
      },
      paymentMethod,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* Whatever the server refused that wasn't a single field's fault —
            an empty cart, a product that sold out, a closed shop. */}
        {error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Could not place your order</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Panel step={1} title="Delivery address">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="fullName"
              label="Full name"
              value={address.fullName}
              onChange={set("fullName")}
              error={fieldErrors["shippingAddress.fullName"]}
              autoComplete="name"
              required
            />
            <Field
              id="phone"
              label="Phone number"
              value={address.phone}
              onChange={set("phone")}
              error={fieldErrors["shippingAddress.phone"]}
              autoComplete="tel"
              inputMode="tel"
              placeholder="98XXXXXXXX"
              required
            />
            <Field
              id="line1"
              label="Address"
              value={address.line1}
              onChange={set("line1")}
              error={fieldErrors["shippingAddress.line1"]}
              autoComplete="address-line1"
              placeholder="Street, ward, landmark"
              className="sm:col-span-2"
              required
            />
            <Field
              id="line2"
              label="Apartment, suite (optional)"
              value={address.line2 ?? ""}
              onChange={set("line2")}
              error={fieldErrors["shippingAddress.line2"]}
              autoComplete="address-line2"
              className="sm:col-span-2"
            />
            <Field
              id="city"
              label="City / Municipality"
              value={address.city}
              onChange={set("city")}
              error={fieldErrors["shippingAddress.city"]}
              autoComplete="address-level2"
              required
            />
            <Field
              id="state"
              label="Province / State"
              value={address.state}
              onChange={set("state")}
              error={fieldErrors["shippingAddress.state"]}
              autoComplete="address-level1"
              required
            />
            <Field
              id="postalCode"
              label="Postal code"
              value={address.postalCode}
              onChange={set("postalCode")}
              error={fieldErrors["shippingAddress.postalCode"]}
              autoComplete="postal-code"
              required
            />
            <Field
              id="country"
              label="Country"
              value={address.country}
              onChange={set("country")}
              error={fieldErrors["shippingAddress.country"]}
              autoComplete="country-name"
              required
            />
          </div>

          <Field
            id="notes"
            label="Delivery notes (optional)"
            value={notes}
            onChange={setNotes}
            error={fieldErrors.notes}
            maxLength={500}
            placeholder="e.g. Leave with the security guard"
            className="mt-3"
          />
        </Panel>

        <Panel step={2} title="Payment method">
          <fieldset className="flex flex-col gap-2.5">
            <legend className="sr-only">Payment method</legend>

            {OFFERED_METHODS.map((method) => (
              <label
                key={method}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors",
                  paymentMethod === method
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={() => setPaymentMethod(method)}
                  className="size-4 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {PAYMENT_METHOD_LABELS[method]}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {PAYMENT_METHOD_HINTS[method]}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {fieldErrors.paymentMethod ? (
            <p className="mt-2 text-sm text-destructive">
              {fieldErrors.paymentMethod}
            </p>
          ) : null}

          {paymentMethod === "ESEWA" ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Your order is placed first, then eSewa opens to take the
              payment. If anything goes wrong you can pay again from the
              order page — nothing is lost.
            </p>
          ) : null}
        </Panel>

        <Panel
          step={3}
          title={`Review items (${String(cart.summary.itemCount)})`}
        >
          <ul className="flex flex-col gap-3">
            {cart.items.map((item) => (
              <li key={item.productId} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.name ?? "Unavailable item"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[item.vendorName, `Qty ${String(item.quantity)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold tabular-nums">
                  {formatPrice(item.lineTotal)}
                </p>
              </li>
            ))}
          </ul>

          <Button
            render={<Link href={routes.cart} />}
            variant="ghost"
            size="sm"
            className="mt-3 -ml-2.5"
          >
            Edit cart
          </Button>
        </Panel>
      </div>

      <aside className="flex flex-col gap-4 self-start rounded-2xl bg-card p-5 ring-1 ring-foreground/10 lg:sticky lg:top-20">
        <h2 className="font-heading text-lg font-semibold">Order total</h2>

        <dl className="flex flex-col gap-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">
              Subtotal ({pluralize(cart.summary.totalQuantity, "item")})
            </dt>
            <dd className="font-mono font-semibold tabular-nums">
              {formatPrice(cart.summary.subtotal)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">
              Delivery ({pluralize(cart.summary.vendorCount, "parcel")})
            </dt>
            <dd className="font-mono font-semibold tabular-nums">
              {cart.summary.shippingFee === 0
                ? "Free"
                : formatPrice(cart.summary.shippingFee)}
            </dd>
          </div>

          <div className="my-1 border-t" />

          <div className="flex items-center justify-between gap-3">
            <dt className="text-base font-semibold">Total due</dt>
            <dd className="font-mono text-xl font-bold tabular-nums">
              {formatPrice(cart.summary.grandTotal)}
            </dd>
          </div>
        </dl>

        <Button
          type="submit"
          size="lg"
          className="h-12 w-full"
          disabled={isPlacing}
        >
          {isPlacing ? "Placing your order…" : "Place order"}
        </Button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {cart.summary.vendorCount > 1
            ? `Your ${pluralize(cart.summary.vendorCount, "item")} ship as ${pluralize(cart.summary.vendorCount, "separate parcel")}, each tracked on its own.`
            : "You can cancel any part of this order until it ships."}
        </p>
      </aside>
    </form>
  );
}

function Panel({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <h2 className="mb-4 flex items-center gap-2.5 font-heading text-base font-semibold">
        <span className="flex size-5.5 items-center justify-center rounded-full bg-primary text-[0.625rem] font-bold text-primary-foreground">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * A labelled input with its server-side error underneath.
 *
 * `aria-invalid` drives `Input`'s destructive ring, so the error is
 * announced and styled from the same one prop — the same arrangement as
 * `AuthField`.
 */
function Field({
  id,
  label,
  value,
  onChange,
  error,
  className,
  ...inputProps
}: Omit<React.ComponentProps<"input">, "onChange" | "value" | "id"> & {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        className="h-10"
        {...inputProps}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
