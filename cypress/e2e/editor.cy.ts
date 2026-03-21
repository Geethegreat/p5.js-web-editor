describe('p5.js Editor - Cypress', () => {
  function dismissCookies() {
    cy.get('button').then(($buttons) => {
      const dismiss = [...$buttons].find((b) =>
        /accept|ok|got it|agree|close|dismiss|continue/i.test(
          b.textContent || ''
        )
      );
      if (dismiss) cy.wrap(dismiss).click({ force: true });
    });
  }

  function clickPlayButton() {
    cy.get('[aria-label="Play sketch"]').click({ force: true });
  }

  it('editor loads and has a sketch iframe', () => {
    cy.visit('/');
    dismissCookies();
    clickPlayButton();
    cy.get('iframe', { timeout: 15000 }).should('exist');
  });

  it('can access iframe content frame', () => {
    cy.visit('/');
    dismissCookies();
    cy.get('iframe').then(($iframe) => {
      // Cypress iframe workaround — needs .contents() jQuery hack
      const body = $iframe.contents().find('body');
      cy.wrap(body).should('exist');
    });
  });

  it('run button triggers sketch, checks iframe src', () => {
    cy.visit('/');
    dismissCookies();
    clickPlayButton();
    cy.get('iframe', { timeout: 15000 })
      .should('have.attr', 'src')
      .and('include', 'localhost:8002');
  });
});
