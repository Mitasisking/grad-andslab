module.exports = {
  async redirects() {
    return [
      {
        // /batches was folded into /submit's own top-of-page batch panel.
        source: '/batches',
        destination: '/submit',
        permanent: true,
      },
      {
        // The standalone policy pages were retired once the Shipping and
        // Refund & Return policies moved into the Terms & Conditions
        // (app/terms/page.tsx sections 5 and 6).
        source: '/shipping-policy',
        destination: '/terms#shipping-policy',
        permanent: true,
      },
      {
        source: '/refund-policy',
        destination: '/terms#refund-policy',
        permanent: true,
      },
    ]
  },
};
