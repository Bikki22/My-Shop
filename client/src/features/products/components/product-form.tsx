"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { routes } from "@/config/routes";
import { useCategoriesQuery } from "@/features/categories/hooks/use-categories-query";
import { useSaveProduct } from "../hooks/use-product-mutations";
import { PRODUCT_LIMITS, type Product, type ProductInput } from "../types";

/**
 * The listing editor, for both creating and updating.
 *
 * One component for both because the fields are identical — the server's
 * update schema is the create schema made partial. What differs is only where
 * it posts and where it lands afterwards, which `useSaveProduct` handles.
 *
 * Validation is deliberately thin here: `required`, `min` and `maxLength` on
 * the inputs catch the obvious mistakes before a round trip, and everything
 * else is left to the server, which owns the real rules and phrases them. A
 * second copy of those rules in the browser is a second copy to drift.
 *
 * Photos are collected here as **URLs**, which is what the create endpoint
 * requires — it wants at least one image and the upload endpoint files
 * assets under an existing product's id, so there is nothing to upload *to*
 * until the listing exists. Uploading files is therefore a second step, on
 * the edit screen a new listing lands on; see `ProductImageManager`.
 */
export function ProductForm({ product }: { product?: Product }) {
  const categories = useCategoriesQuery();
  const { save, isPending } = useSaveProduct(product?._id);

  // Uncontrolled would be simpler, but `tags` and `images` are both a single
  // string in the UI and an array over the wire, so they need somewhere to
  // live between the two shapes.
  const [tags, setTags] = useState(product?.tags.join(", ") ?? "");
  const [images, setImages] = useState(product?.images.join("\n") ?? "");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const input: ProductInput = {
      categoryId: String(form.get("categoryId")),
      name: String(form.get("name")).trim(),
      description: String(form.get("description")).trim(),
      brand: String(form.get("brand")).trim(),
      price: Number(form.get("price")),
      stock: Number(form.get("stock")),
      isFeatured: form.get("isFeatured") === "on",
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      images: images
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean),
    };

    await save(input);
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name" htmlFor="name" className="sm:col-span-2">
          <Input
            id="name"
            name="name"
            required
            minLength={PRODUCT_LIMITS.nameMin}
            maxLength={PRODUCT_LIMITS.nameMax}
            defaultValue={product?.name}
            placeholder="Handwoven wool scarf"
          />
        </Field>

        <Field label="Brand" htmlFor="brand">
          <Input
            id="brand"
            name="brand"
            defaultValue={product?.brand}
            placeholder="Your label, or leave blank"
          />
        </Field>

        <Field label="Category" htmlFor="categoryId">
          <NativeSelect
            id="categoryId"
            name="categoryId"
            required
            defaultValue={
              product?.categoryId?._id ?? categories[0]?._id ?? ""
            }
          >
            {categories.length === 0 ? (
              <option value="">No categories available</option>
            ) : (
              categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))
            )}
          </NativeSelect>
        </Field>

        <Field
          label="Description"
          htmlFor="description"
          className="sm:col-span-2"
          hint={`At least ${String(PRODUCT_LIMITS.descriptionMin)} characters.`}
        >
          <Textarea
            id="description"
            name="description"
            required
            minLength={PRODUCT_LIMITS.descriptionMin}
            rows={5}
            defaultValue={product?.description}
            placeholder="What it is, what it is made of, and how big it is."
          />
        </Field>

        <Field label="Price (Rs.)" htmlFor="price">
          <Input
            id="price"
            name="price"
            type="number"
            required
            min={0}
            step="0.01"
            defaultValue={product?.price}
          />
        </Field>

        <Field
          label="Stock"
          htmlFor="stock"
          hint="Zero means nobody can buy it."
        >
          <Input
            id="stock"
            name="stock"
            type="number"
            required
            min={0}
            step={1}
            defaultValue={product?.stock ?? 0}
          />
        </Field>

        <Field
          label="Photo URLs"
          htmlFor="images"
          className="sm:col-span-2"
          hint={`One per line, ${String(PRODUCT_LIMITS.imagesMin)}–${String(PRODUCT_LIMITS.imagesMax)} of them. Once the listing exists you can upload files instead.`}
        >
          <Textarea
            id="images"
            name="images"
            required
            rows={3}
            value={images}
            onChange={(event) => {
              setImages(event.target.value);
            }}
            placeholder="https://res.cloudinary.com/…/scarf.jpg"
          />
        </Field>

        <Field
          label="Tags"
          htmlFor="tags"
          className="sm:col-span-2"
          hint="Comma separated. These are what search matches on."
        >
          <Input
            id="tags"
            name="tags"
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
            }}
            placeholder="wool, winter, handmade"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={product?.isFeatured}
            className="size-4 rounded border-input accent-primary"
          />
          <span>Feature this listing on your storefront</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending || categories.length === 0}>
          {isPending
            ? "Saving…"
            : product
              ? "Save changes"
              : "Publish listing"}
        </Button>
        <Button
          render={<Link href={routes.seller.products} />}
          variant="ghost"
          type="button"
        >
          Cancel
        </Button>
        {categories.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            A listing needs a category, and none are available yet.
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
