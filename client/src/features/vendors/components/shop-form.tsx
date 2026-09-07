"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { routes } from "@/config/routes";
import { isApiError } from "@/lib/api";
import { useApi } from "@/lib/api/client";
import { applyVendorRequest, updateMyVendorRequest } from "../api/vendor.api";
import type {
  ApplyVendorInput,
  PayoutAccount,
  PayoutMethod,
  UpdateMyVendorInput,
  Vendor,
} from "../types";

/**
 * The shop form, for applying and for editing afterwards.
 *
 * One component for both because the fields are nearly identical — the
 * server's update schema is the application schema made partial, minus the
 * name. That exception is structural rather than cosmetic: the storefront
 * slug is derived from the name, so letting a shop rename itself would move
 * its URL and break every link pointing at it. Renaming is an admin action,
 * which is why the name field is read-only once the shop exists.
 *
 * The payout account is a discriminated union on the server, so the form
 * switches its fields on the chosen method rather than showing all of them
 * and letting a half-filled bank account through — "method BANK with no
 * account number" has to be impossible to submit, not a support ticket on the
 * first payout run.
 */
export function ShopForm({ shop }: { shop?: Vendor }) {
  const api = useApi();
  const router = useRouter();

  const [method, setMethod] = useState<PayoutMethod>(
    shop?.payoutAccount.method ?? "ESEWA",
  );

  const mutation = useMutation({
    mutationFn: (input: ApplyVendorInput | UpdateMyVendorInput) => {
      const { path, ...options } = shop
        ? updateMyVendorRequest(input as UpdateMyVendorInput)
        : applyVendorRequest(input as ApplyVendorInput);
      return api<Vendor>(path, options);
    },
    onSuccess: () => {
      toast.success(
        shop
          ? "Shop updated"
          : "Application submitted — an admin will review it",
      );
      router.push(routes.seller.root);
      router.refresh();
    },
    onError: (error) => {
      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      throw error;
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const payoutAccount: PayoutAccount =
      method === "ESEWA"
        ? { method: "ESEWA", esewaId: String(form.get("esewaId")).trim() }
        : {
            method: "BANK",
            bankName: String(form.get("bankName")).trim(),
            accountName: String(form.get("accountName")).trim(),
            accountNumber: String(form.get("accountNumber")).trim(),
          };

    const address = {
      line1: String(form.get("line1")).trim(),
      line2: String(form.get("line2")).trim() || null,
      city: String(form.get("city")).trim(),
      state: String(form.get("state")).trim(),
      postalCode: String(form.get("postalCode")).trim(),
      country: String(form.get("country")).trim(),
    };

    const shared = {
      description: String(form.get("description")).trim(),
      email: String(form.get("email")).trim(),
      phone: String(form.get("phone")).trim(),
      address,
      payoutAccount,
    };

    void mutation.mutateAsync(
      shop ? shared : { ...shared, name: String(form.get("name")).trim() },
    );
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-base font-medium">The shop</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shop name" htmlFor="name" className="sm:col-span-2">
            <Input
              id="name"
              name="name"
              required={!shop}
              minLength={2}
              maxLength={60}
              defaultValue={shop?.name}
              readOnly={Boolean(shop)}
              aria-describedby={shop ? "name-hint" : undefined}
              className={shop ? "bg-muted" : undefined}
            />
            {shop ? (
              <p id="name-hint" className="text-xs text-muted-foreground">
                Your storefront URL is built from this, so only an admin can
                change it — moving it would break every link to your shop.
              </p>
            ) : null}
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            className="sm:col-span-2"
          >
            <Textarea
              id="description"
              name="description"
              rows={3}
              maxLength={1000}
              defaultValue={shop?.description}
              placeholder="What you sell, and what makes it yours."
            />
          </Field>

          <Field label="Contact email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={shop?.email}
            />
          </Field>

          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" required defaultValue={shop?.phone} />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-base font-medium">Business address</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" htmlFor="line1" className="sm:col-span-2">
            <Input
              id="line1"
              name="line1"
              required
              maxLength={120}
              defaultValue={shop?.address.line1}
            />
          </Field>
          <Field label="Address line 2" htmlFor="line2" className="sm:col-span-2">
            <Input
              id="line2"
              name="line2"
              maxLength={120}
              defaultValue={shop?.address.line2 ?? ""}
            />
          </Field>
          <Field label="City" htmlFor="city">
            <Input
              id="city"
              name="city"
              required
              maxLength={60}
              defaultValue={shop?.address.city}
            />
          </Field>
          <Field label="State / province" htmlFor="state">
            <Input
              id="state"
              name="state"
              required
              maxLength={60}
              defaultValue={shop?.address.state}
            />
          </Field>
          <Field label="Postal code" htmlFor="postalCode">
            <Input
              id="postalCode"
              name="postalCode"
              required
              defaultValue={shop?.address.postalCode}
            />
          </Field>
          <Field label="Country" htmlFor="country">
            <Input
              id="country"
              name="country"
              required
              maxLength={60}
              defaultValue={shop?.address.country ?? "Nepal"}
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-base font-medium">
          Where we send your money
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Method" htmlFor="method">
            <NativeSelect
              id="method"
              value={method}
              onChange={(event) => {
                setMethod(event.target.value as PayoutMethod);
              }}
            >
              <option value="ESEWA">eSewa</option>
              <option value="BANK">Bank transfer</option>
            </NativeSelect>
          </Field>

          {method === "ESEWA" ? (
            <Field label="eSewa ID" htmlFor="esewaId">
              <Input
                id="esewaId"
                name="esewaId"
                required
                maxLength={40}
                defaultValue={
                  shop?.payoutAccount.method === "ESEWA"
                    ? shop.payoutAccount.esewaId
                    : ""
                }
              />
            </Field>
          ) : (
            <>
              <Field label="Bank name" htmlFor="bankName">
                <Input
                  id="bankName"
                  name="bankName"
                  required
                  maxLength={80}
                  defaultValue={
                    shop?.payoutAccount.method === "BANK"
                      ? shop.payoutAccount.bankName
                      : ""
                  }
                />
              </Field>
              <Field label="Account holder name" htmlFor="accountName">
                <Input
                  id="accountName"
                  name="accountName"
                  required
                  maxLength={80}
                  defaultValue={
                    shop?.payoutAccount.method === "BANK"
                      ? shop.payoutAccount.accountName
                      : ""
                  }
                />
              </Field>
              <Field label="Account number" htmlFor="accountNumber">
                <Input
                  id="accountNumber"
                  name="accountNumber"
                  required
                  defaultValue={
                    shop?.payoutAccount.method === "BANK"
                      ? shop.payoutAccount.accountNumber
                      : ""
                  }
                />
              </Field>
            </>
          )}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? "Saving…"
            : shop
              ? "Save changes"
              : "Submit application"}
        </Button>
        {!shop ? (
          <p className="text-xs text-muted-foreground">
            An admin reviews every application before a shop goes live.
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
