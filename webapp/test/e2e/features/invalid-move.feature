Feature: Invalid move

  Scenario: User cannot play in an occupied cell
    Given I am logged in with a newly registered user
    And I am on a started game
    When I play in a cell
    And I play again in the same cell
    Then I should see an error or no change