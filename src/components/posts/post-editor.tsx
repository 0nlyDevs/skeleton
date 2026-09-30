"use client";

import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import type { PostDto } from "@/modules/posts/posts.dto";
import type { MessageKey } from "@/lib/i18n";

const BODY_MAX = 20_000;

/**
 * Shared editor for creating and editing a post.
 *
 * One component for both flows because they are the same form with different
 * initial values and a different verb; two implementations would drift within a
 * day. Field errors come straight from the API's `fields` map, so a validation
 * message rendered next to the input is the server's verdict, not a guess.
 *
 * The submit button is disabled while pending **and** after success until the
 * navigation completes — the double-submit window is closed at the UI layer even
 * though the API would make the second call a harmless 409-or-update.
 */
export function PostEditor({ post }: { readonly post?: PostDto }) {
  const t = useTranslation();
  const router = useRouter();
  const isEdit = Boolean(post);

  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [tagsInput, setTagsInput] = useState((post?.tags ?? []).join(", "));
  const [published, setPublished] = useState(post?.published ?? false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const parsedTags = tagsInput
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 10);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      title: title.trim(),
      body,
      published,
      tags: parsedTags,
    };

    try {
      const response = isEdit && post
        ? await apiFetch<{ data: PostDto }>(`/api/posts/${post.id}`, {
            method: "PATCH",
            body: payload,
          })
        : await apiFetch<{ data: PostDto }>("/api/posts", { method: "POST", body: payload });

      const createdId = response.data?.id;
      if (!createdId) {
        // The server accepted the write but the body did not match the
        // contract; unlocking is the only safe move — navigating blind would
        // land on /posts/undefined.
        setPending(false);
        setFormError("INTERNAL_ERROR");
        return;
      }

      // Replace, not push: the editor must not survive the back button.
      // `pending` intentionally stays true through the navigation so the
      // submit button cannot fire twice; the component unmounts on success.
      router.replace(`/posts/${createdId}`);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        if (caught.fields) setFieldErrors(caught.fields);
        setFormError(caught.code);
      } else {
        setFormError("NETWORK_ERROR");
      }
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold tracking-[-0.015em]">
            {isEdit ? t("posts.edit.title") : t("posts.new.title")}
          </h1>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={isEdit && post ? `/posts/${post.id}` : "/posts"}>
            <ArrowLeft />
            {t("common.back")}
          </Link>
        </Button>
      </header>

      {formError ? (
        <Alert variant="error">
          <AlertCircle />
          <AlertDescription>
            {formError === "NETWORK_ERROR"
              ? t("feedback.network")
              : (t(`error.${formError}` as MessageKey) === `error.${formError}`
                  ? t("feedback.error.body")
                  : t(`error.${formError}` as MessageKey))}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-5 p-5">
        <FormField
          label={t("posts.field.title")}
          required
          {...(fieldErrors.title ? { error: fieldErrors.title } : {})}
        >
          {(field) => (
            <Input
              {...field}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={140}
              placeholder={t("posts.field.title")}
              required
            />
          )}
        </FormField>

        <FormField
          label={t("posts.field.body")}
          required
          {...(fieldErrors.body ? { error: fieldErrors.body } : {})}
        >
          {(field) => (
            <Textarea
              {...field}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={10}
              maxLength={BODY_MAX}
              required
              className="min-h-48 resize-y"
            />
          )}
        </FormField>

        <FormField
          label={t("posts.field.tags")}
          hint={t("posts.field.tags_hint")}
          {...(fieldErrors.tags ? { error: fieldErrors.tags } : {})}
        >
          {(field) => (
            <Input
              {...field}
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="webcup, nextjs, mysql"
            />
          )}
        </FormField>

        <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-relaxed">
          <Checkbox
            className="mt-0.5"
            checked={published}
            onCheckedChange={(value) => setPublished(value === true)}
          />
          <span className="flex flex-col">
            <span className="font-medium">{t("posts.field.published")}</span>
            <span className="text-muted-foreground">{t("posts.field.published_hint")}</span>
          </span>
        </label>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
          <span className="text-[12px] tabular-nums text-muted-foreground">
            {body.length} / {BODY_MAX}
          </span>
          <Button type="submit" size="lg" disabled={pending || title.trim().length === 0 || body.trim().length === 0}>
            {pending ? <Spinner className="size-4" /> : null}
            {pending ? t("common.saving") : isEdit ? t("common.save") : t("common.create")}
          </Button>
        </div>
      </Card>
    </form>
  );
}
