Feature: Stats data

Scenario: User sees stats after playing a game
  Given I am logged in with a newly registered user
  And I play a game
  When I go to the statistics page
  Then I should see at least one game in history