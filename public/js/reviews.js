document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reviewForm");
  const message = document.getElementById("reviewMessage");
  if (!form || !message) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      rating: Number(formData.get("rating")),
      review_text: String(formData.get("review_text") || "").trim()
    };

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (response.redirected) {
        window.location.href = response.url;
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to submit your review.");
      message.textContent = "Thank you. Your review has been submitted.";
      form.reset();
      window.location.reload();
    } catch (error) {
      message.textContent = error.message || "Please log in before submitting a review.";
    }
  });
});
