const server = Bun.serve({
  routes: {
    // Landing page
    "/": Bun.file("./out/index.html"),

    // Serve static files
    "/style.css": Bun.file("./static/style.css"),
    "/script.js": Bun.file("./static/script.js"),
    "/favicon.svg": Bun.file("./static/favicon.svg"),

    // Serve images from out/images
    "/images/:filename": (req) => {
      const filename = req.params.filename;
      return new Response(Bun.file(`./out/images/${filename}`));
    },
  },

  // Custom error handler
  async error() {
    const html = await Bun.file("./static/error.html").text();
    return new Response(html, {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  },
});

console.log(`Server running at ${server.url}`);
