Feature: Game
  Validate the game board page behaviour

  Scenario: Game page shows start prompt before a game begins
    Given I am logged in as "prueba1" with password "prueba1"
    When I navigate to the game page with bot "random_bot" and board size "7"
    Then I should see the start game prompt
    And the send move button should not be visible

  Scenario: Starting a new game renders the board
    Given I am logged in as "prueba1" with password "prueba1"
    When I navigate to the game page with bot "random_bot" and board size "7"
    And I click the new game button
    Then the game board should be visible
    And the board should contain circles

  Scenario: Clicking a cell selects it
    Given I am logged in as "prueba1" with password "prueba1"
    And a game is in progress with bot "random_bot" and board size "7"
    When I click an empty cell on the board
    Then that cell should appear selected

  Scenario: Send move button appears after game starts
    Given I am logged in as "prueba1" with password "prueba1"
    And a game is in progress with bot "random_bot" and board size "7"
    Then the send move button should be visible

  Scenario: Back button navigates to home
    Given I am logged in as "prueba1" with password "prueba1"
    When I navigate to the game page with bot "random_bot" and board size "7"
    And I click the back button
    Then I should be on the home page

  Scenario: Restart button starts a new game
    Given I am logged in as "prueba1" with password "prueba1"
    And a game is in progress with bot "random_bot" and board size "7"
    When I click the new game button
    Then the game board should be visible

  Scenario: Board size label is shown in the toolbar
    Given I am logged in as "prueba1" with password "prueba1"
    When I navigate to the game page with bot "random_bot" and board size "9"
    Then I should see the board size label "9×9"
