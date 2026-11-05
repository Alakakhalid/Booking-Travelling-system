document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.querySelector("#searchBtn");
  const searchInput = document.querySelector("#searchInput");
  const results = document.querySelector("#results");
  const hamburger = document.querySelector(".hambugger");
  const navList = document.querySelector(".nav-list");
  const authButtons = document.querySelector(".auth-buttons");

  // Rotate through the video files that actually exist in public/videos.
  const videoList = [
    "/videos/travel1.mp4",
    "/videos/travel2.mp4",
    "/videos/travel3.mp4",
    "/videos/travel4.mp4",
    "/videos/travel5.mp4"
  ];
  const video = document.getElementById("landingVideo");
  if (video && video.querySelector("source")) {
    let videoIndex = 0;
    video.querySelector("source").src = videoList[videoIndex];
    video.load();
    video.play().catch(() => {});
    window.setInterval(() => {
      videoIndex = (videoIndex + 1) % videoList.length;
      video.querySelector("source").src = videoList[videoIndex];
      video.load();
      video.play().catch(() => {});
    }, 10000);
  }

  hamburger?.addEventListener("click", () => {
    navList?.classList.toggle("active");
    authButtons?.classList.toggle("active");
  });

  function showMessage(message) {
    if (results) results.textContent = message;
  }

  function renderImage(item, query) {
    const card = document.createElement("article");
    card.className = "card image-card";

    const image = document.createElement("img");
    image.src = item?.urls?.regular || item?.urls?.small || "";
    image.alt = item?.alt_description || query;
    image.loading = "lazy";

    const heading = document.createElement("h3");
    heading.textContent = item?.alt_description || query;

    card.append(image, heading);
    return card;
  }

  searchBtn?.addEventListener("click", async () => {
    const query = searchInput?.value.trim();
    if (!query) {
      showMessage("Please enter a destination or hotel search.");
      return;
    }
    if (!results) return;

    results.replaceChildren();
    showMessage("Searching...");
    try {
      const response = await fetch(`/api/images?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed.");

      results.replaceChildren();
      if (!Array.isArray(data.results) || data.results.length === 0) {
        showMessage(`No images found for "${query}".`);
        return;
      }
      data.results.forEach((item) => results.appendChild(renderImage(item, query)));
    } catch (error) {
      showMessage(error.message || "Unable to complete your search.");
    }
  });

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchBtn?.click();
  });

  // Featured destination cards
  const destinationContainer = document.getElementById("destinations");
  if (destinationContainer) {
    fetch("/api/featured-destinations")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load destinations.");
        return response.json();
      })
      .then((destinations) => {
        destinationContainer.replaceChildren();
        destinations.forEach((destination) => {
          const card = document.createElement("article");
          card.className = "card country-card";

          const image = document.createElement("img");
          image.src = destination.image;
          image.alt = destination.city;
          image.loading = "lazy";

          const title = document.createElement("h3");
          title.textContent = destination.city;

          const description = document.createElement("p");
          description.textContent = destination.description || "";

          const link = document.createElement("a");
          link.className = "btn";
          link.href = `/book/${encodeURIComponent(destination.city)}`;
          link.textContent = "View Details";

          card.append(image, title, description, link);
          destinationContainer.appendChild(card);
        });
      })
      .catch((error) => console.error(error));
  }

  // Recent reviews
  const reviewContainer = document.getElementById("review-cards");
  if (reviewContainer) {
    fetch("/api/reviews?limit=3")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load reviews.");
        return response.json();
      })
      .then((reviews) => {
        reviewContainer.replaceChildren();
        reviews.forEach((review) => {
          const card = document.createElement("article");
          card.className = "testimonial-card";

          const name = document.createElement("h4");
          name.textContent = review.username || "Traveler";

          const body = document.createElement("p");
          body.textContent = review.review_text || "";

          const stars = document.createElement("div");
          stars.className = "stars";
          stars.textContent = `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}`;

          card.append(name, body, stars);
          reviewContainer.appendChild(card);
        });
      })
      .catch((error) => console.error(error));
  }
});
