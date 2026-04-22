Feature: Bot turn

  Scenario: Bot plays after user move
    Given I am logged in with a newly registered user
    And I am on a started game
    When I make a move
    Then the bot should make a move automatically