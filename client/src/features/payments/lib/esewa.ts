import type { EsewaCheckoutForm } from "../types";

/**
 * Hands the browser to eSewa.
 *
 * A real form submit, built and submitted from script, because eSewa's ePay
 * endpoint answers with its own payment page — `fetch` would download that
 * page into JavaScript that cannot show it, and a `GET` redirect would drop
 * the signed fields. The form is removed again on the way out so a shopper
 * who returns via the back button does not find a stray element in the DOM.
 *
 * Nothing here decides anything about the payment: the fields are signed
 * server-side and the outcome is settled by the server asking eSewa's status
 * API when the browser comes back.
 */
export function submitEsewaForm({ formUrl, fields }: EsewaCheckoutForm): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = formUrl;
  form.style.display = "none";

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  }

  document.body.append(form);
  form.submit();
  form.remove();
}
