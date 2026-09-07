"use client";

import { useState, type FormEvent } from "react";
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCategoryAdmin } from "../hooks/use-category-admin";
import type { Category, CategoryInput } from "../types";

/**
 * The category tree, edited in place.
 *
 * One screen rather than a list plus separate create and edit pages, because
 * a category is four fields — a full page each would be more navigation than
 * content. The form doubles as both: it creates when nothing is selected and
 * updates when a row is being edited.
 *
 * Deactivating rather than deleting is the usual move and the table says so:
 * a soft-deleted category still has products filed under it, and an inactive
 * one simply stops appearing in the shopper's filter rail.
 */
export function CategoryManager({
  categories,
}: {
  categories: readonly Category[];
}) {
  const { save, remove, isPending } = useCategoryAdmin();
  const [editing, setEditing] = useState<Category | null>(null);
  // Remounts the form when the selection changes, so its uncontrolled inputs
  // pick up the new defaults instead of keeping the previous row's values.
  const formKey = editing?._id ?? "new";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const input: CategoryInput = {
      name: String(form.get("name")).trim(),
      description: String(form.get("description")).trim(),
      image: String(form.get("image")).trim() || null,
      isActive: form.get("isActive") === "on",
    };

    if (await save(input, editing?._id)) {
      setEditing(null);
      event.currentTarget.reset();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form
        key={formKey}
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-base font-medium">
            {editing ? `Edit “${editing.name}”` : "New category"}
          </h2>
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(null);
              }}
            >
              <XIcon />
              Cancel
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              name="name"
              required
              minLength={2}
              maxLength={50}
              defaultValue={editing?.name}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-image">Image URL</Label>
            <Input
              id="category-image"
              name="image"
              type="url"
              defaultValue={editing?.image ?? ""}
              placeholder="Optional"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={editing?.description}
            />
          </div>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={editing?.isActive ?? true}
              className="size-4 rounded border-input accent-primary"
            />
            <span>
              Active — inactive categories stay on their products but drop out
              of the shopper&rsquo;s filters
            </span>
          </label>
        </div>

        <div>
          <Button type="submit" disabled={isPending}>
            {!editing ? <PlusIcon /> : null}
            {isPending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create category"}
          </Button>
        </div>
      </form>

      {categories.length === 0 ? (
        <p className="rounded-xl bg-card px-6 py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          No categories yet. Products need one, so this is the first thing to
          set up.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category._id}>
                  <TableCell className="max-w-[20rem] whitespace-normal">
                    <span className="font-medium">{category.name}</span>
                    {category.description ? (
                      <span className="block text-xs text-muted-foreground">
                        {category.description}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {category.slug}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={category.isActive ? "secondary" : "outline"}
                    >
                      {category.isActive ? "Active" : "Hidden"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(category);
                        }}
                      >
                        <PencilIcon />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => void remove(category._id)}
                      >
                        <Trash2Icon />
                        <span className="sr-only">
                          Remove {category.name}
                        </span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
